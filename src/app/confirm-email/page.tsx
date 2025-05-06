"use client";

import { Box, Button, Typography, Container, Paper, CircularProgress } from "@mui/material";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase"; // Ensure this imports your Firebase config
import { sendEmailVerification } from "firebase/auth";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function ConfirmEmailPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoToLogin = () => {
    router.push("/login");
  };

  const handleResendEmailVerification = async () => {
    setLoading(true);
    setError(null); // Clear any previous error messages

    try {
      const user = auth.currentUser;
      if (user) {
        // Send email verification
        await sendEmailVerification(user);
        setLoading(false);
        alert("Verification email sent! Please check your inbox.");
      } else {
        throw new Error("No authenticated user found.");
      }
    } catch (err) {
      setLoading(false);
      setError("Failed to send verification email. Please try again.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #f6f9fc 0%, #ffffff 100%)",
        padding: { xs: 2, sm: 4 },
      }}
    >
      <LoadingOverlay isLoading={loading} message="Sending verification email..." />
      
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            mt: 5,
            bgcolor: "background.default",
            color: "text.primary",
            borderRadius: 2,
            textAlign: "center",
            width: "100%",
            maxWidth: 400,
            mx: "auto",
          }}
        >
          <Typography variant="h5" component="h1" gutterBottom>
            Please Check Your Email
          </Typography>

          <Typography variant="body1" paragraph>
            We have sent a verification email to your email address. Please check
            your inbox (or spam folder) to confirm your email address.
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            If you haven't received the email yet, make sure to check your spam
            folder. You can also resend the verification email by clicking the
            button below.
          </Typography>

          {/* Resend Verification Email Button */}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleResendEmailVerification}
              fullWidth
              disabled={loading}
              sx={{ fontWeight: "bold", textTransform: "none" }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Resend Verification Email"}
            </Button>
          </Box>

          {error && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}

          {/* Go to Login Button */}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleGoToLogin}
              fullWidth
              sx={{ fontWeight: "bold", textTransform: "none" }}
            >
              Go to Login
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
