import { NextRequest, NextResponse } from "next/server";
import { saveProfile } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!body.deliveryEmail || typeof body.deliveryEmail !== "string") {
    return NextResponse.json(
      { error: "Delivery email is required" },
      { status: 400 }
    );
  }

  try {
    await saveProfile(user.id, {
      name: body.name,
      title: body.title ?? "",
      yearsExperience: body.yearsExperience ?? null,
      backgroundSummary: body.backgroundSummary ?? "",
      linkedinUrl: body.linkedinUrl ?? "",
      resumes: body.resumes ?? [],
      roleLevels: body.roleLevels ?? [],
      focusAreas: body.focusAreas ?? [],
      locations: body.locations ?? [],
      targetCompanies: body.targetCompanies ?? [],
      exclusions: body.exclusions ?? "",
      deliveryEmail: body.deliveryEmail,
      deliveryMethod: body.deliveryMethod === "inapp" ? "inapp" : "email",
      gmailOptIn: Boolean(body.gmailOptIn)
    });
  } catch (e) {
    return NextResponse.json({ error: "Couldn't save profile" }, { status: 500 });
  }

  return NextResponse.json({ id: user.id });
}
