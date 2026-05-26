from string import Template


def render_template(template_str: str, **variables) -> str:
    """Render email template with variable substitution."""
    return Template(template_str).safe_substitute(**variables)
