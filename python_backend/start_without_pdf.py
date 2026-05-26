"""
Temporary startup script that disables PDF functionality to avoid WeasyPrint dependency issues.
This allows the backend to start while WeasyPrint GTK dependencies are being resolved.
"""
import sys
import os

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Mock the PDF module before importing the app
import unittest.mock as mock

# Mock weasyprint and related PDF modules
sys.modules['weasyprint'] = mock.MagicMock()
sys.modules['app.pdf.renderer'] = mock.MagicMock()
sys.modules['app.pdf.exporter'] = mock.MagicMock()

# Now import and run the app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=True)
