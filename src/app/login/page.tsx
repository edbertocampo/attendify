"use client";

import { Box, Button, TextField, Typography, Container, Paper, CircularProgress, IconButton, InputAdornment } from "@mui/material";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth, db } from "../../lib/firebase"; // Ensure Firebase is properly imported
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { Visibility, VisibilityOff } from '@mui/icons-material';
import LoadingOverlay from "../../components/LoadingOverlay";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [emailVerifiedError, setEmailVerifiedError] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User already logged in:", user);
        await redirectToDashboard(user.uid);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Redirect user based on role
  const redirectToDashboard = async (uid: string) => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === "instructor") {
          router.push("/dashboard/instructor");
        } else {
          router.push("/dashboard/student");
        }
      } else {
        console.error("User role not found in Firestore.");
        setError("Error retrieving user role.");
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      setError("Error retrieving user role.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setEmailVerifiedError(false);

    try {
      // Set persistent login
      await setPersistence(auth, browserLocalPersistence);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log("Logged in user:", user);

      if (!user.emailVerified) {
        setEmailVerifiedError(true);
        setLoading(false);
        return;
      }

      await redirectToDashboard(user.uid);
    } catch (err: any) {
      if (err instanceof FirebaseError) {
        setError("Invalid email or password. Please try again.");
      } else {
        setError("An unknown error occurred. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
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
      <LoadingOverlay isLoading={loading} message="Logging in..." />
      
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            bgcolor: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(10px)",
            color: "text.primary",
            borderRadius: "24px",
            textAlign: "center",
            border: "1px solid rgba(0, 0, 0, 0.05)",
            transition: "all 0.3s ease",
          }}
        >
          <Image
            src="/attendify.png"
            alt="App Logo"
            width={80}
            height={80}
            priority
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "80px",
              maxHeight: "80px",
              marginBottom: "24px",
              animation: "fadeIn 0.6s ease-out",
            }}
          />

          <Typography 
            variant="h4" 
            component="h1" 
            sx={{
              fontWeight: 700,
              fontSize: { xs: "24px", sm: "28px" },
              mb: 1,
              background: "linear-gradient(90deg, #007AFF 0%, #005ECF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Welcome Back
          </Typography>

          <Typography 
            variant="body1" 
            sx={{ 
              mb: 4, 
              color: "text.secondary",
              fontSize: "15px" 
            }}
          >
            Sign in to continue to your account
          </Typography>

          {error && (
            <Typography 
              color="error" 
              sx={{ 
                mb: 2,
                p: 1.5,
                bgcolor: "rgba(211, 47, 47, 0.05)",
                borderRadius: 2,
                fontSize: "14px"
              }}
            >
              {error}
            </Typography>
          )}

          {emailVerifiedError && (
            <Typography 
              color="error" 
              sx={{ 
                mb: 2,
                p: 1.5,
                bgcolor: "rgba(211, 47, 47, 0.05)",
                borderRadius: 2,
                fontSize: "14px"
              }}
            >
              Your email is not verified. Please check your inbox.
            </Typography>
          )}

          <Box
            component="form"
            onSubmit={handleLogin}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              width: "100%",
            }}
          >
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              variant="outlined"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: 'rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.03)',
                  },
                  '&.Mui-focused': {
                    bgcolor: 'white',
                    boxShadow: '0 0 0 2px rgba(0, 122, 255, 0.2)',
                  }
                }
              }}
            />

            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              required
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePassword}
                      edge="end"
                      sx={{
                        transition: 'transform 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'scale(1.1)',
                        },
                      }}
                    >
                      {showPassword ? (
                        <VisibilityOff sx={{ color: 'text.secondary' }} />
                      ) : (
                        <Visibility sx={{ color: 'text.secondary' }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: 'rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.03)',
                  },
                  '&.Mui-focused': {
                    bgcolor: 'white',
                    boxShadow: '0 0 0 2px rgba(0, 122, 255, 0.2)',
                  }
                }
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                mt: 2,
                fontWeight: 600,
                textTransform: "none",
                borderRadius: "14px",
                height: "52px",
                fontSize: "16px",
                background: "linear-gradient(90deg, #007AFF 0%, #005ECF 100%)",
                boxShadow: "0 4px 12px rgba(0, 122, 255, 0.2)",
                "&:hover": {
                  background: "linear-gradient(90deg, #0066FF 0%, #004CBF 100%)",
                  boxShadow: "0 6px 16px rgba(0, 122, 255, 0.3)",
                },
                transition: "all 0.3s ease",
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: "white" }} />
              ) : (
                "Sign In"
              )}
            </Button>

            <Typography 
              variant="body2" 
              sx={{ 
                mt: 3,
                color: "text.secondary",
                fontSize: "14px"
              }}
            >
              Don't have an account?{" "}
              <Button
                onClick={() => router.push("/signup")}
                sx={{
                  color: "#007AFF",
                  fontWeight: 600,
                  textTransform: "none",
                  padding: "0 4px",
                  minWidth: "unset",
                  "&:hover": {
                    background: "transparent",
                    color: "#005ECF",
                  },
                }}
              >
                Sign up
              </Button>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
