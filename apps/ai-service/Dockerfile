FROM python:3.12-slim

WORKDIR /srv
COPY requirements.txt requirements-ocr.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-ocr.txt \
    && apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY app ./app

# data/ (runbook, ảnh, phản hồi) được mount từ ngoài vào /data
ENV AI_DATA_DIR=/data
EXPOSE 8001
USER nobody
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
