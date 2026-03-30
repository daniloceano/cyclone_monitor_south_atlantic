/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */

import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: "cyclone-auth",
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
