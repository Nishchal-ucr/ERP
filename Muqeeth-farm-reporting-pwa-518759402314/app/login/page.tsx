"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useAuth } from "@/lib/auth-context";
import { LoginDto } from "@/lib/types";
import { LockIcon, PhoneIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { loginUser, user } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  if (user) {
    router.push("/");
    return null;
  }

  const handleLogin = async () => {
    if (!phone || !password) {
      setError("Please enter both phone and password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const credentials: LoginDto = { phone, password };
      await loginUser(credentials);
      router.push("/");
    } catch (error) {
      console.error("Error occurred during login.", error);
      setError("Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm min-h-screen flex flex-col px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="relative w-24 h-12">
              <Image
                src="/images/flygoog-logo-img.png"
                alt="Eggs"
                fill
                className="object-contain"
              />
            </div>
          </div>

          <h1 className="text-2xl font-semibold mt-4">Sign In</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Give credential to sign in your account.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          {/* Phone */}
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="phone"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <PhoneIcon className="size-4 text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>
          </Field>

          {/* Password */}
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <LockIcon className="size-4 text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>
          </Field>

          {/* Remember / Forgot */}
          {/* <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <Label htmlFor="remember">Remember Me</Label>
            </div>

            <Button variant="link" size="default">
              Forgot Password?
            </Button>
          </div> */}

          {/* Sign In Button */}
          <Button
            onClick={handleLogin}
            className="w-full"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </Button>
        </div>
      </div>
    </div>
  );
}
