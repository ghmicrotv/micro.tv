FROM golang:1.26.3

WORKDIR /app

# Копируем go.mod и go.sum из текущей рабочей директории
COPY go.mod go.sum ./
RUN go mod download

# Копируем весь остальной код бэкенда
COPY . ./

# Копируем медиафайлы из родительской папки репозитория (вверх на один уровень)
COPY ../../Media/ /Media/

RUN CGO_ENABLED=0 go build -o /app/api ./cmd/api

ENV KADR_ADDR=:8080
ENV KADR_DATA=data
ENV KADR_MEDIA=/Media

EXPOSE 8080

CMD ["/app/api"]
