
FROM golang:1.26.3

WORKDIR /app

COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download

COPY apps/api/ ./
COPY Media/ /Media/

RUN CGO_ENABLED=0 go build -o /app/api ./cmd/api

ENV KADR_ADDR=:8080
ENV KADR_DATA=data
ENV KADR_MEDIA=/Media

EXPOSE 8080

CMD ["/app/api"]
