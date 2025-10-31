// hooks/usePythPrices.ts
import { useEffect, useRef, useState } from "react";
import { HermesClient } from "@pythnetwork/hermes-client";

/**
 * Price shape returned by the hook for each feed
 */
export type PythPrice = {
  price?: number | null;
  conf?: number | null;
  expo?: number | null;
  publish_time?: string | null; // ISO string when available
  slot?: number | null;
  raw?: any; // original parsed update for debugging
};

/**
 * Map of priceId keys to PythPrice
 */
export type PriceMap = Record<string, PythPrice>;

/**
 * Default feed ids (as provided by you)
 */
export const PRICE_IDS = {
  SOL_USD: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  USDC_USD: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  USDT_USD: "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
} as const;

const ID_TO_SYMBOL: Record<string, string> = {
  [PRICE_IDS.SOL_USD]: "SOL",
  [PRICE_IDS.USDC_USD]: "USDC",
  [PRICE_IDS.USDT_USD]: "USDT",
};

/**
 * Hook options
 */
type UsePythOptions = {
  endpoint?: string;
  priceIds?: string[];
  reconnect?: boolean;
  maxBackoffMs?: number;
};

export function usePythPrices({
  endpoint = "https://hermes.pyth.network",
  priceIds = Object.values(PRICE_IDS),
  reconnect = true,
  maxBackoffMs = 30_000,
}: UsePythOptions = {}) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hermesRef = useRef<HermesClient | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const backoffRef = useRef<number>(1000);

  // Convert Pyth price object (with integer price + expo) to JS number and metadata
  function convertPriceObject(obj: any) {
    if (!obj) return { price: null, conf: null, expo: null, publish_time: null };
    const expo = typeof obj.expo === "number" ? obj.expo : Number(obj.expo ?? 0);
    const priceInt = obj.price != null ? Number(obj.price) : null;
    const confInt = obj.conf != null ? Number(obj.conf) : null;
    const priceValue = priceInt != null ? priceInt * Math.pow(10, expo) : null;
    const publishTime =
      obj.publish_time != null ? new Date(Number(obj.publish_time) * 1000).toISOString() : null;
    return { price: priceValue, conf: confInt != null ? confInt * Math.pow(10, expo) : null, expo, publish_time: publishTime };
  }

  // helper to parse Hermes price update payload (handles multiple shapes)
  function parseUpdate(item: any): PythPrice {
    // item may be:
    // 1) { id, price: {...}, ema_price: {...}, metadata: {...} }  <-- your streaming sample
    // 2) { parsed: { price: {...} }, id: '...' } or other variations
    const raw = item;
    const idFromItem = item?.id ?? item?.price_id ?? item?.priceId;

    // Prefer the direct price object in several shapes
    const directPriceObj = item?.price ?? item?.parsed?.price ?? item?.parsed ?? item;

    // If directPriceObj itself has an 'price' numeric string (like { price: "123", expo: -8 }), convert it
    const conv = convertPriceObject(directPriceObj);

    // metadata such as slot
    const slot = item?.metadata?.slot ?? item?.parsed?.metadata?.slot ?? null;

    const result: PythPrice = {
      price: conv.price,
      conf: conv.conf,
      expo: conv.expo,
      publish_time: conv.publish_time,
      slot: slot != null ? Number(slot) : null,
      raw,
    };

    return result;
  }

  // fetch initial latest prices (REST)
  async function fetchLatest() {
    try {
      setIsLoading(true);
      setError(null);

      if (!hermesRef.current) hermesRef.current = new HermesClient(endpoint, {});
      const client = hermesRef.current;

      const resp = await client.getLatestPriceUpdates(priceIds);
      const parsedList = resp.parsed ?? resp.results ?? resp;

      const map: PriceMap = {};

      if (Array.isArray(parsedList)) {
        // parsedList entries may be { id, price: {...}, metadata: {...} }
        parsedList.forEach((item: any, i: number) => {
          const id = item?.id ?? priceIds[i] ?? `feed_${i}`;
          map[id] = parseUpdate(item);
        });
      } else if (typeof parsedList === "object") {
        Object.entries(parsedList).forEach(([id, item]: any) => {
          map[id] = parseUpdate(item);
        });
      }

      setPrices((prev) => ({ ...prev, ...map }));
    } catch (err: any) {
      console.error("fetchLatest error", err);
      setError(String(err?.message ?? err));
    } finally {
      setIsLoading(false);
    }
  }

  // start SSE subscription
  function startStreaming() {
    if (!hermesRef.current) hermesRef.current = new HermesClient(endpoint, {});
    const client = hermesRef.current;

    if (sseRef.current) {
      try {
        sseRef.current.close();
      } catch {}
      sseRef.current = null;
    }

    let es: EventSource | null = null;
    try {
      // try Hermes client's helper first
      // @ts-ignore
      es = client.getStreamingPriceUpdates(priceIds);
    } catch (err) {
      console.warn("Failed to call getStreamingPriceUpdates on HermesClient directly, attempting manual SSE...");
      const url = new URL("/v2/updates/price/stream", endpoint);
      // append each id as its own ids[] param
      priceIds.forEach((id) => url.searchParams.append("ids[]", id));
      es = new EventSource(url.toString());
    }

    if (!es) {
      setError("Failed to open EventSource for Hermes streaming.");
      return;
    }

    sseRef.current = es;

    es.onopen = () => {
      backoffRef.current = 1000;
      setIsConnected(true);
      setError(null);
    };

    es.onmessage = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data);

        // The message you provided has a top-level "parsed": [ {id, price: {...}}, ... ]
        const payloadArray = Array.isArray(data)
          ? data
          : Array.isArray(data.parsed)
          ? data.parsed
          : // sometimes server sends { id, price: {...} } single object
          Array.isArray(data.updates)
          ? data.updates
          : [data];

        setPrices((prev) => {
          const next = { ...prev };
          payloadArray.forEach((entry: any) => {
            // entries may be { id, price: {...}, metadata: {...} } or { parsed: { ... } }
            const entryShape = entry?.parsed ? entry.parsed : entry;
            const id = entry?.id ?? entryShape?.id ?? entryShape?.price_id ?? entryShape?.priceId;
            if (id) {
              next[id] = parseUpdate(entry);
            } else if (entryShape?.id) {
              next[entryShape.id] = parseUpdate(entryShape);
            } else {
              // unknown shape: try to derive from known priceIds order (best-effort)
              // if there's just one update, map to first requested id
              if (payloadArray.length === 1 && priceIds.length === 1) {
                next[priceIds[0]] = parseUpdate(entry);
              } else {
                // stash under a useful 'unknown' bucket with timestamp
                const key = `unknown_${Date.now()}`;
                next[key] = { raw: entry };
              }
            }
          });
          return next;
        });
      } catch (e) {
        console.warn("Failed to parse Hermes SSE message", e, evt.data);
      }
    };

    es.onerror = (err) => {
      console.error("Hermes SSE error", err);
      setIsConnected(false);
      try {
        es?.close();
      } catch {}
      sseRef.current = null;
      if (reconnect) {
        const backoff = Math.min(backoffRef.current, maxBackoffMs);
        setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, maxBackoffMs);
          startStreaming();
        }, backoff);
      } else {
        setError("SSE connection closed.");
      }
    };
  }

  // stop streaming and cleanup
  function stopStreaming() {
    if (sseRef.current) {
      try {
        sseRef.current.close();
      } catch {}
      sseRef.current = null;
    }
    setIsConnected(false);
  }

  // effect: initialize + subscribe
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await fetchLatest();
        if (!mounted) return;
        startStreaming();
      } catch (err: any) {
        setError(String(err?.message ?? err));
      }
    })();

    return () => {
      mounted = false;
      stopStreaming();
      try {
        hermesRef.current = null;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, priceIds.join(",")]);

  return {
    prices: Object.entries(prices).reduce((acc, [id, value]) => {
      const symbol = ID_TO_SYMBOL[id] || id; // fallback to id if unknown
      acc[symbol] = value;
      return acc;
    }, {} as Record<string, PythPrice>),
    isConnected,
    isLoading,
    error,
    refresh: fetchLatest,
    startStreaming,
    stopStreaming,
  };
}
