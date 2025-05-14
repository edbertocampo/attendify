"use client";

import { useState, useEffect } from "react";
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress, Tabs, Tab, IconButton, InputAdornment } from "@mui/material";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { Visibility, VisibilityOff } from "@mui/icons-material";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await user.reload();
        if (user.emailVerified) {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, { emailVerified: true });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (password: string) => password.length >= 6;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (fullName.trim().length < 3) {
      setError({ field: "fullName", message: "Full Name must be at least 3 characters." });
      setLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setError({ field: "email", message: "Invalid email format." });
      setLoading(false);
      return;
    }

    if (!validatePassword(password)) {
      setError({ field: "password", message: "Password must be at least 6 characters." });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError({ field: "confirmPassword", message: "Passwords do not match." });
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);

      const userRef = doc(db, "users", userCredential.user.uid);
      await setDoc(userRef, {
        fullName,
        idNumber,
        email,
        role,
        emailVerified: userCredential.user.emailVerified,
        createdAt: new Date(),
      });

      router.push("/confirm-email");
    } catch (err: any) {
      setError({ message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #eaf0fb 0%, #f6f9fc 100%)", // blue-tinted background
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
            border: "1px solid #dbeafe", // blue-tinted border
            transition: "all 0.3s ease",
          }}
        >
          <Image
            src="/attendify.svg"
            alt="Attendify Logo"
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
          />          <Typography 
            variant="h4" 
            component="h1" 
            sx={{
              fontFamily: 'var(--font-gilroy)',
              fontWeight: 700,
              fontSize: { xs: "24px", sm: "28px" },
              mb: 1,
              background: "linear-gradient(90deg, #334eac 0%, #22357a 100%)", // theme gradient
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Create Account
          </Typography>          <Typography 
            variant="body1" 
            sx={{ 
              fontFamily: 'var(--font-nunito)',
              mb: 4, 
              color: "text.secondary",
              fontSize: "15px" 
            }}
          >
            Join us to start tracking attendance efficiently
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
              {error.message}
            </Typography>
          )}

          <Tabs
            value={activeTab}
            onChange={(e, newValue) => {
              if (!loading) {
                setActiveTab(newValue);
                setRole(newValue === 0 ? "student" : "instructor");
              }
            }}
            variant="fullWidth"
            sx={{
              mb: 4,
              borderRadius: "16px",
              bgcolor: "rgba(51, 78, 172, 0.06)", // blue-tinted
              padding: "4px",
              "& .MuiTabs-indicator": { display: "none" },
              "& .MuiTab-root": {
                fontSize: "15px",
                fontWeight: 600,
                textTransform: "none",
                transition: "all 0.3s ease",
                borderRadius: "12px",
                color: loading ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.6)",
                minHeight: "44px",
                "&.Mui-selected": {
                  bgcolor: "#334eac",
                  color: "white",
                  boxShadow: "0 4px 12px rgba(51, 78, 172, 0.18)",
                },
              },
            }}
          >
            <Tab label="Student" />
            <Tab label="Instructor" />
          </Tabs>

          <Box
            component="form"
            onSubmit={handleSignup}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              width: "100%",
            }}
          >
            {(activeTab === 0 || activeTab === 1) && (
              <>
                <TextField
                  label="Full Name"
                  type="text"
                  fullWidth
                  required
                  variant="outlined"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  error={error?.field === "fullName"}
                  helperText={error?.field === "fullName" ? error.message : ""}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: 'rgba(51, 78, 172, 0.04)', // blue-tinted
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(51, 78, 172, 0.07)',
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white',
                        boxShadow: '0 0 0 2px rgba(51, 78, 172, 0.18)',
                      }
                    }
                  }}
                />
                <TextField
                  label={activeTab === 0 ? "Student ID Number" : "Instructor ID Number"}
                  type="text"
                  fullWidth
                  required
                  variant="outlined"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
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
                      }
                    }
                  }}
                />
              </>
            )}

            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              variant="outlined"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error?.field === "email"}
              helperText={error?.field === "email" ? error.message : ""}
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
                  }
                }
              }}
            />

            <TextField
              label="Password"
              type={isClient && showPassword ? "text" : "password"}
              fullWidth
              required
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error?.field === "password"}
              helperText={error?.field === "password" ? error.message : "At least 6 characters."}
              InputProps={{
                endAdornment: isClient ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{
                        color: 'rgba(0, 0, 0, 0.54)',
                        transition: 'color 0.2s ease',
                        '&:hover': {
                          color: '#334eac',
                        },
                      }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ) : null
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
                  }
                }
              }}
            />

            <TextField
              label="Confirm Password"
              type={isClient && showConfirmPassword ? "text" : "password"}
              fullWidth
              required
              variant="outlined"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={error?.field === "confirmPassword"}
              helperText={error?.field === "confirmPassword" ? error.message : ""}
              InputProps={{
                endAdornment: isClient ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      sx={{
                        color: 'rgba(0, 0, 0, 0.54)',
                        transition: 'color 0.2s ease',
                        '&:hover': {
                          color: '#334eac',
                        },
                      }}
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ) : null
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
                <CircularProgress 
                  size={24} 
                  sx={{ color: "white" }} 
                /> 
              ) : (
                "Create Account"
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
              Already have an account?{" "}
              <Link 
                href="/login" 
                style={{ 
                  color: "#334eac", 
                  fontWeight: 600, 
                  textDecoration: "none",
                  transition: "color 0.2s ease" 
                }}
                onMouseOver={e => (e.currentTarget.style.color = '#22357a')}
                onMouseOut={e => (e.currentTarget.style.color = '#334eac')}
              >
                Sign in
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
