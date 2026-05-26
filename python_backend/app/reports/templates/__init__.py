from pathlib import Path


def render_template(template_name: str, context: dict) -> str:
    """Render HTML template with context."""
    template_path = Path(__file__).parent / "templates" / template_name
    template_content = template_path.read_text(encoding="utf-8")

    # Simple template rendering (replace {{ variable }} with values)
    for key, value in context.items():
        template_content = template_content.replace(f"{{{{ {key} }}}}", str(value))

    # Handle loops (basic implementation for daily_breakdown)
    if "{% for day in daily_breakdown %}" in template_content:
        loop_start = template_content.find("{% for day in daily_breakdown %}")
        loop_end = template_content.find("{% endfor %}")
        if loop_start != -1 and loop_end != -1:
            loop_template = template_content[loop_start + 32:loop_end]
            loop_content = ""
            for day in context.get("daily_breakdown", []):
                row = loop_template
                for key, value in day.items():
                    row = row.replace(f"{{{{ day.{key} }}}}", str(value))
                loop_content += row
            template_content = (
                template_content[:loop_start] +
                loop_content +
                template_content[loop_end + 13:]
            )

    return template_content
