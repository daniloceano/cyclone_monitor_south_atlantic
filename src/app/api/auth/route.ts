/**
 * POST /api/auth
 * Validates the submitted password against the SITE_PASSWORD environment
 * variable and sets an httpOnly session cookie on success.
 */

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    console.error("SITE_PASSWORD environment variable is not set.");
    return NextResponse.json(
      { error: "Server misconfigured: authentication is not enabled." },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.password || body.password !== sitePassword) {
    // Small delay to slow down brute-force attempts
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: "cyclone-auth",
    value: "authenticated",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return response;
}
