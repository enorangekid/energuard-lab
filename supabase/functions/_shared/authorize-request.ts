export class RequestAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "RequestAuthError";
    this.status = status;
  }
}

type AuthorizedRequest =
  | { kind: "cron" }
  | { kind: "user"; userId: string; email: string };

function safeEqual(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function authorizeRequest(request: Request): Promise<AuthorizedRequest> {
  const configuredCronSecret = Deno.env.get("ENERGUARD_CRON_SECRET")?.trim() || "";
  const requestCronSecret = request.headers.get("x-energuard-cron-secret")?.trim() || "";
  if (configuredCronSecret && safeEqual(requestCronSecret, configuredCronSecret)) {
    return { kind: "cron" };
  }

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  if (!accessToken) throw new RequestAuthError("로그인이 필요합니다.", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() || "";
  if (!supabaseUrl || !anonKey) {
    throw new RequestAuthError("인증 서버 설정이 누락되었습니다.", 500);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!userResponse.ok) throw new RequestAuthError("로그인 세션이 만료되었습니다.", 401);

  const user = await userResponse.json().catch(() => null) as { id?: string; email?: string } | null;
  const userId = user?.id?.trim() || "";
  if (!userId) throw new RequestAuthError("사용자 정보를 확인할 수 없습니다.", 401);

  const adminUserIds = new Set(
    (Deno.env.get("ADMIN_USER_IDS") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (!adminUserIds.size) throw new RequestAuthError("관리자 허용 목록이 설정되지 않았습니다.", 500);
  if (!adminUserIds.has(userId)) throw new RequestAuthError("이 기능을 사용할 권한이 없습니다.", 403);

  return { kind: "user", userId, email: user?.email?.trim() || "" };
}
