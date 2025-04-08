FROM nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04

# 필수 패키지 설치
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv python3-dev \
    git \
    ffmpeg portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

# 가상환경 생성
RUN python3 -m venv /opt/venv

# PATH 환경변수를 설정하여 가상환경 자동 활성화
ENV PATH="/opt/venv/bin:$PATH"

# 작업 디렉토리 설정
WORKDIR /app

# 소스 코드 복사
COPY stt_server.py /app/
COPY requirements.txt /app/

# pip 업그레이드 및 패키지 설치 (자동으로 가상환경 내에서 진행됨)
RUN pip3 install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# stt_server가 사용하는 기본 포트와 streamlit 포트를 열어줌
EXPOSE 8011 8012

# 서버 자동 실행 설정
CMD ["sh", "-c", "python3 stt_server.py \
    --model large-v3 \
    --rt-model large-v3 \
    --language ko \
    --control 8011 \
    --data 8012 \
    --use_extended_logging \
    --enable_realtime_transcription \
    2>&1 | tee /app/stt_server.log"] 