FROM alphacep/kaldi-vosk-server:latest

ENV UZVERSION=0.22
RUN mkdir /opt/vosk-model-small-uz \
   && cd /opt/vosk-model-small-uz \
   && wget -q http://alphacephei.com/kaldi/models/vosk-model-small-uz-${UZVERSION}.zip \
   && unzip vosk-model-small-uz-${UZVERSION}.zip \
   && mv vosk-model-small-uz-${UZVERSION} model \
   && rm -rf model/extra \
   && rm -rf vosk-model-small-uz-${UZVERSION}.zip

EXPOSE 2700
WORKDIR /opt/vosk-server/websocket
CMD [ "python3", "./asr_server.py", "/opt/vosk-model-small-uz/model" ]
