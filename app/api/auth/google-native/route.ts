import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleSupabase } from "@/lib/supabase/service-role";

const GOOGLE_TOKEN_INFO = "https://oauth2.googleapis.com/tokeninfo";

const ALLOWED_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID ?? "";

export async function POST(req: NextRequest) {
  try {
    const { id_token } = await req.json();
    if (!id_token) {
      return NextResponse.json({ error: "Missing id_token" }, { status: 400 });
    }

    const gRes = await fetch(`${GOOGLE_TOKEN_INFO}?id_token=${id_token}`);
    if (!gRes.ok) {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }

    const claims = await gRes.json();

    if (claims.aud !== ALLOWED_IOS_CLIENT_ID) {
      return NextResponse.json({ error: "Audience mismatch" }, { status: 401 });
    }
    if (!claims.email || claims.email_verified !== "true") {
      return NextResponse.json({ error: "Email not verified" }, { status: 401 });
    }

    const supabase = getServiceRoleSupabase();

    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let user = existingUsers?.users?.find((u) => u.email === claims.email);

    if (!user) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: claims.email,
        email_confirm: true,
        user_metadata: {
          full_name: claims.name,
          avatar_url: claims.picture,
          sub: claims.sub,
          provider: "google",
        },
        app_metadata: { provider: "google", providers: ["google"] },
      });
      if (error || !created.user) {
        return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 500 });
      }
      user = created.user;

      const username = claims.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_-]/g, "");
      await supabase.from("profiles").upsert({
        id: user.id,
        email: claims.email,
        full_name: claims.name,
        avatar_url: claims.picture,
        username,
      }, { onConflict: "id" });
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: claims.email,
    });

    if (linkError || !linkData) {
      return NextResponse.json({ error: linkError?.message ?? "Link failed" }, { status: 500 });
    }

    const otp = linkData.properties?.email_otp ?? "";

    if (!otp) {
      return NextResponse.json({ error: "No OTP generated" }, { status: 500 });
    }

    return NextResponse.json({ email: claims.email, otp });
  } catch (e: any) {
    console.error("[google-native]", e);
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}
