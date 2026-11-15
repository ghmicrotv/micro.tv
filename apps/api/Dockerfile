FROM golang:1.26.3

WORKDIR /app

# Копируем go.mod и go.sum из подпапки бэкенда
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download

# Копируем весь исходный код бэкенда внутрь контейнера
COPY apps/api/ ./

# Копируем медиафайлы из папки Media в корне репозитория
COPY Media/ /Media/

RUN CGO_ENABLED=0 go build -o /app/api ./cmd/api

ENV KADR_ADDR=:8080
ENV KADR_DATA=data
ENV KADR_MEDIA=/Media

EXPOSE 8080

CMD ["/app/api"]
