export class DailyQuotaError extends Error {
  status: number;

  constructor(message: string, status = 429) {
    super(message);
    this.name = "DailyQuotaError";
    this.status = status;
  }
}

type QuotaResult = {
  allowed?: boolean;
  used?: number;
  remaining?: number;
};

export async function consumeDailyQuota(
  principal: string,
  functionName: string,
  action: string,
  units: number,
  dailyLimit: number,
) {
  const normalizedUnits = Math.max(1, Math.floor(units));
  const normalizedLimit = Math.max(1, Math.floor(dailyLimit));
  const url = Deno.env.get("SUPABASE_URL")?.trim() || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
  if (!url || !serviceRoleKey) {
    throw new DailyQuotaError("AI 사용량 제한 설정이 누락되었습니다.", 500);
  }

  const response = await fetch(`${url}/rest/v1/rpc/consume_edge_function_quota`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      p_principal: principal,
      p_function_name: functionName,
      p_action: action,
      p_units: normalizedUnits,
      p_daily_limit: normalizedLimit,
    }),
  });
  if (!response.ok) {
    throw new DailyQuotaError(`AI 사용량을 확인하지 못했습니다. (${response.status})`, 503);
  }

  const payload = await response.json().catch(() => []) as QuotaResult[] | QuotaResult;
  const result = Array.isArray(payload) ? payload[0] : payload;
  if (!result?.allowed) {
    throw new DailyQuotaError(
      `오늘의 AI 사용 한도에 도달했습니다. (${Number(result?.used || 0)}/${normalizedLimit})`,
    );
  }
  return {
    used: Number(result.used || 0),
    remaining: Number(result.remaining || 0),
  };
}
