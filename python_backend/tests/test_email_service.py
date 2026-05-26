from app.email import EmailService


class _Settings:
    database_url = None
    smtp_host = None
    smtp_port = None
    smtp_user = None
    smtp_password = None
    smtp_from = None
    smtp_use_ssl = False


def test_email_service_reports_logged_fallback_when_smtp_missing(monkeypatch) -> None:
    logged: list[tuple[object, str, str]] = []
    monkeypatch.setattr("app.email.get_settings", lambda: _Settings())
    monkeypatch.setattr(EmailService, "_log_to_file", lambda self, to, subject, body: logged.append((to, subject, body)))

    sent = EmailService().send_email("supervisor@example.com", "Test subject", "<p>body</p>")

    assert sent is False
    assert logged == [("supervisor@example.com", "Test subject", "<p>body</p>")]


def test_email_service_uses_smtp_ssl_when_configured(monkeypatch) -> None:
    calls: list[tuple[str, object]] = []

    class SSLSettings:
        database_url = None
        smtp_host = "smtp.qq.com"
        smtp_port = 465
        smtp_user = "sender@example.com"
        smtp_password = "password"
        smtp_from = "sender@example.com"
        smtp_use_ssl = True

    class FakeSMTPSSL:
        def __init__(self, host, port, timeout):
            calls.append(("connect", (host, port, timeout)))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def starttls(self):
            calls.append(("starttls", None))

        def login(self, user, password):
            calls.append(("login", (user, password)))

        def send_message(self, msg):
            calls.append(("send_message", msg["To"]))

    monkeypatch.setattr("app.email.get_settings", lambda: SSLSettings())
    monkeypatch.setattr("app.email.smtplib.SMTP_SSL", FakeSMTPSSL)

    sent = EmailService().send_email("receiver@example.com", "Test subject", "<p>body</p>")

    assert sent is True
    assert ("connect", ("smtp.qq.com", 465, 20)) in calls
    assert ("starttls", None) not in calls
    assert ("login", ("sender@example.com", "password")) in calls
    assert ("send_message", "receiver@example.com") in calls


def test_email_service_prefers_user_editable_smtp_settings(monkeypatch) -> None:
    calls: list[tuple[str, object]] = []

    class RuntimeSettings:
        database_url = "postgresql://example"
        smtp_host = "smtp.env.example.com"
        smtp_port = 587
        smtp_user = "env@example.com"
        smtp_password = "env-password"
        smtp_from = "env@example.com"
        smtp_use_ssl = False

    class FakeCursorConnection:
        def execute(self, sql, params):
            assert params == ("default",)
            return self

        def fetchone(self):
            return (
                {
                    "smtpHost": "smtp.user.example.com",
                    "smtpPort": 465,
                    "smtpUser": "user@example.com",
                    "smtpPassword": "user-password",
                    "smtpFrom": "LabManager <user@example.com>",
                    "smtpUseSsl": True,
                },
            )

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    class FakeSMTPSSL:
        def __init__(self, host, port, timeout):
            calls.append(("connect", (host, port, timeout)))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def login(self, user, password):
            calls.append(("login", (user, password)))

        def send_message(self, msg):
            calls.append(("send_message", (msg["From"], msg["To"])))

    monkeypatch.setattr("app.email.get_settings", lambda: RuntimeSettings())
    monkeypatch.setattr("app.email.psycopg.connect", lambda database_url: FakeCursorConnection())
    monkeypatch.setattr("app.email.smtplib.SMTP_SSL", FakeSMTPSSL)

    sent = EmailService().send_email("receiver@example.com", "Test subject", "<p>body</p>")

    assert sent is True
    assert ("connect", ("smtp.user.example.com", 465, 20)) in calls
    assert ("login", ("user@example.com", "user-password")) in calls
    assert ("send_message", ("LabManager <user@example.com>", "receiver@example.com")) in calls
