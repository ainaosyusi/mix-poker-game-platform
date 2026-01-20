# Logging and Metrics

## JSONL output
Set `LOG_TO_FILE=1` to write JSONL logs.

Environment variables:
- `LOG_DIR` (default: `./logs`)
- `LOG_FILE` (default: `server.jsonl`)
- `LOG_MAX_BYTES` (default: `5000000`)
- `METRICS_WINDOW_SEC` (default: `60`)

Each line is a single JSON object with shared fields:
- `ts` (ISO8601)
- `pid`
- `uptimeMs`
- `event`

Example:
```json
{"ts":"2025-01-01T00:00:00.000Z","pid":1234,"uptimeMs":42000,"event":"room_joined","roomId":"123456","playerName":"Alice"}
```

## Metrics
Metrics are aggregated in memory and flushed every `METRICS_WINDOW_SEC` as `event: "metric"`.

Fields:
- `metric` (name)
- `value` (count)
- `tags` (optional)
- `windowSec`

Example:
```json
{"ts":"2025-01-01T00:01:00.000Z","pid":1234,"uptimeMs":90000,"event":"metric","metric":"action_invalid","value":7,"tags":{"reason":"invalid_token"},"windowSec":60}
```
