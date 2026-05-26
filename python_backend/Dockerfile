FROM python:3.13-slim

# Install WeasyPrint system dependencies
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy application code
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -e .

# Copy bundled fonts
COPY app/assets/fonts /app/app/assets/fonts

# Set font path environment variable
ENV FONT_DIR=/app/app/assets/fonts

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
