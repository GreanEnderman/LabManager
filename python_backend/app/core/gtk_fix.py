"""
Fix for WeasyPrint GTK3 DLL loading on Windows with Python 3.8+

Python 3.8+ changed DLL search behavior for security reasons.
This script adds the GTK3 bin directory to the DLL search path.
"""
import os
import sys

# Add GTK3 bin directory to DLL search path (Python 3.8+)
gtk_bin_path = r"D:\Program Files\GTK3-Runtime Win64\bin"

if os.path.exists(gtk_bin_path):
    if sys.version_info >= (3, 8):
        # Python 3.8+ requires explicit DLL directory
        os.add_dll_directory(gtk_bin_path)
    else:
        # Older Python versions
        os.environ['PATH'] = gtk_bin_path + os.pathsep + os.environ.get('PATH', '')

    print(f"Added GTK3 DLL directory: {gtk_bin_path}")
else:
    print(f"Warning: GTK3 directory not found at {gtk_bin_path}")
    print("WeasyPrint PDF functionality may not work.")
