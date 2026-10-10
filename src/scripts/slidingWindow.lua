-- KEYS[1]: Rate limit key (e.g., "rate_limit:ip:127.0.0.1")
-- ARGV[1]: Current timestamp (milliseconds)
-- ARGV[2]: Window size (milliseconds, e.g., 60000 for 1 minute)
-- ARGV[3]: Maximum allowed requests in window
-- ARGV[4]: Unique request identifier (UUID or timestamp + random string)



local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local request_id = ARGV[4]

local clear_before = now - window



-- ZREMRANGEBYSCORE: Removes values from a specific range in a sorted set (a ZSET)
redis.call('ZREMRANGEBYSCORE', key, 0, clear_before)

local current_requests = redis.call('ZCARD', key)

if current_requests < limit then
    -- Add current request to ZSET
    redis.call('ZADD', key, now, request_id)

    -- Sets a TTL (Time to live) on the key to clean up idle sets
    redis.call('EXPIRE', key, math.ceil(window / 1000))
    return {1, current_requests + 1} -- Allowed
else
    return {0, current_requests} -- Denied
end