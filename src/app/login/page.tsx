"use client";

import { Box, Button, TextField, Typography, Container, Paper, CircularProgress, IconButton, InputAdornment, Modal, Alert } from "@mui/material";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth, db } from "../../lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { Visibility, VisibilityOff } from '@mui/icons-material';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [emailVerifiedError, setEmailVerifiedError] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Forgot password states
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>("");
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false);
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User already logged in:", user);
        await redirectToDashboard(user.uid);
      }
    });

    return () => unsubscribe();
  }, [router]);

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
      await setPersistence(auth, browserLocalPersistence);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

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

  const handleForgotPassword = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      setResetEmailError("Please enter a valid email address");
      return;
    }
    
    setResetLoading(true);
    setResetEmailError(null);
    
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetEmailSent(true);
      setResetLoading(false);
    } catch (error) {
      setResetEmailError("Failed to send password reset email. Please check the email address.");
      setResetLoading(false);
    }
  };
  
  const handleCloseForgotPassword = () => {
    setForgotPasswordOpen(false);
    setResetEmail("");
    setResetEmailSent(false);
    setResetEmailError(null);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #eaf0fb 0%, #f6f9fc 100%)",
        padding: { xs: 2, sm: 4 },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            bgcolor: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(10px)",
            color: "text.primary",
            borderRadius: "24px",
            textAlign: "center",
            border: "1px solid #dbeafe",
            transition: "all 0.3s ease",
          }}
        >
          <Image
            src="/attendify.svg"
            alt="App Logo"
            width={100}
            height={100}
            priority
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "150px",
              maxHeight: "150px",
              marginBottom: "24px",
              animation: "fadeIn 0.6s ease-out",
            }}
          />
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{
              fontFamily: 'var(--font-gilroy)',
              fontWeight: 700,
              fontSize: { xs: "24px", sm: "28px" },
              mb: 1,
              background: "linear-gradient(90deg, #334eac 0%, #22357a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Welcome Back
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              fontFamily: 'var(--font-nunito)',
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
                fontFamily: 'var(--font-nunito)',
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
                fontFamily: 'var(--font-nunito)',
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
                  bgcolor: 'rgba(51, 78, 172, 0.04)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(51, 78, 172, 0.07)',
                  },
                  '&.Mui-focused': {
                    bgcolor: 'white',
                    boxShadow: '0 0 0 2px rgba(51, 78, 172, 0.18)',
                  },
                  '& input:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px rgba(51, 78, 172, 0.04) inset',
                    WebkitTextFillColor: '#333',
                    caretColor: '#333',
                  },
                  '& input:-webkit-autofill:hover': {
                    WebkitBoxShadow: '0 0 0 1000px rgba(51, 78, 172, 0.07) inset',
                  },
                  '& input:-webkit-autofill:focus': {
                    WebkitBoxShadow: '0 0 0 1000px white inset',
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
                  bgcolor: 'rgba(51, 78, 172, 0.04)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(51, 78, 172, 0.07)',
                  },
                  '&.Mui-focused': {
                    bgcolor: 'white',
                    boxShadow: '0 0 0 2px rgba(51, 78, 172, 0.18)',
                  },
                  '& input:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px rgba(51, 78, 172, 0.04) inset',
                    WebkitTextFillColor: '#333',
                    caretColor: '#333',
                  },
                  '& input:-webkit-autofill:hover': {
                    WebkitBoxShadow: '0 0 0 1000px rgba(51, 78, 172, 0.07) inset',
                  },
                  '& input:-webkit-autofill:focus': {
                    WebkitBoxShadow: '0 0 0 1000px white inset',
                  }
                }
              }}
            />
            
            {/* Forgot Password Link */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
              <Button
                onClick={() => setForgotPasswordOpen(true)}
                sx={{
                  color: '#334eac',
                  fontSize: '13px',
                  textTransform: 'none',
                  p: 0,
                  minWidth: 'unset',
                  fontWeight: 600,
                  '&:hover': {
                    background: 'transparent',
                    color: '#22357a',
                  },
                }}
              >
                Forgot password?
              </Button>
            </Box>

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
                background: "linear-gradient(90deg, #334eac 0%, #22357a 100%)",
                boxShadow: "0 4px 12px rgba(51, 78, 172, 0.18)",
                "&:hover": {
                  background: "linear-gradient(90deg, #22357a 0%, #334eac 100%)",
                  boxShadow: "0 6px 16px rgba(51, 78, 172, 0.28)",
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
                  color: "#334eac",
                  fontWeight: 600,
                  textTransform: "none",
                  padding: "0 4px",
                  minWidth: "unset",
                  "&:hover": {
                    background: "transparent",
                    color: "#22357a",
                  },
                }}
              >
                Sign up
              </Button>
            </Typography>
          </Box>
        </Paper>
      </Container>
      
      {/* Forgot Password Modal */}
      <Modal
        open={forgotPasswordOpen}
        onClose={handleCloseForgotPassword}
        aria-labelledby="forgot-password-modal"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            bgcolor: 'white',
            borderRadius: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            p: 4,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontFamily: 'var(--font-gilroy)',
              fontWeight: 700,
              mb: 1,
              textAlign: 'center',
              color: '#333333', // Added darker text color for better contrast
            }}
          >
            Reset Password
          </Typography>
          
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'var(--font-nunito)',
              mb: 3,
              color: '#555555', // Changed from 'text.secondary' to a darker gray
              textAlign: 'center',
            }}
          >
            Enter your email address and we'll send you a link to reset your password
          </Typography>
          
          {resetEmailSent ? (
            <Alert 
              severity="success" 
              sx={{ 
                mb: 3,
                borderRadius: '12px',
              }}
            >
              Password reset email sent! Check your inbox.
            </Alert>
          ) : (
            <>
              {resetEmailError && (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 3,
                    borderRadius: '12px',
                  }}
                >
                  {resetEmailError}
                </Alert>
              )}
              
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: 'rgba(51, 78, 172, 0.04)',
                    '&.Mui-focused': {
                      bgcolor: 'white',
                      boxShadow: '0 0 0 2px rgba(51, 78, 172, 0.18)',
                    },
                    '& input:-webkit-autofill': {
                      WebkitBoxShadow: '0 0 0 1000px rgba(51, 78, 172, 0.04) inset',
                      WebkitTextFillColor: '#333',
                    },
                  }
                }}
              />
            </>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleCloseForgotPassword}
              sx={{
                flex: 1,
                borderRadius: '12px',
                height: '48px',
                textTransform: 'none',
                fontWeight: 600,
                borderColor: 'rgba(51, 78, 172, 0.3)',
                color: '#334eac',
                '&:hover': {
                  borderColor: '#334eac',
                  background: 'rgba(51, 78, 172, 0.04)',
                },
              }}
            >
              Cancel
            </Button>
            
            <Button
              variant="contained"
              onClick={handleForgotPassword}
              disabled={resetLoading || resetEmailSent}
              sx={{
                flex: 1,
                borderRadius: '12px',
                height: '48px',
                textTransform: 'none',
                fontWeight: 600,
                background: "linear-gradient(90deg, #334eac 0%, #22357a 100%)",
                "&:hover": {
                  background: "linear-gradient(90deg, #22357a 0%, #334eac 100%)",
                },
              }}
            >
              {resetLoading ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : resetEmailSent ? (
                'Sent'
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}
