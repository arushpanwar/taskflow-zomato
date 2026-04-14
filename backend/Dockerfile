###############################################################################
# Stage 1 — Build
###############################################################################
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

ENV GONOSUMDB=*
ENV GOFLAGS=-mod=mod

# Copy only go.mod first so module downloads are cached unless deps change
COPY go.mod ./
RUN go mod download -x 2>&1 | grep -E "^(go:|#)" || true

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -mod=mod -ldflags="-s -w" -o /server ./cmd/server

###############################################################################
# Stage 2 — Runtime (distroless)
###############################################################################
FROM gcr.io/distroless/static-debian12

COPY --from=builder /server /server

EXPOSE 8080

ENTRYPOINT ["/server"]
