"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Tab, 
  Tabs, 
  TextField, 
  Avatar, 
  IconButton, 
  InputAdornment,
  Switch,
  FormControlLabel,
  CircularProgress,
  Snackbar,
  Alert,
  Divider,
  Badge
} from "@mui/material";
import LoadingOverlay from "../../components/LoadingOverlay";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonIcon from "@mui/icons-material/Person";
import SecurityIcon from "@mui/icons-material/Security";
// Removed NotificationsIcon import
import EditIcon from "@mui/icons-material/Edit";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import SaveIcon from "@mui/icons-material/Save";
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import DescriptionIcon from "@mui/icons-material/Description";
import SettingsIcon from "@mui/icons-material/Settings";
import { 
  auth, 
  db 
} from "../../lib/firebase";
import { 
  signOut, 
  updatePassword, 
  updateEmail, 
  EmailAuthProvider, 
  reauthenticateWithCredential,
  updateProfile
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { getAvatarStyles, getInitials } from "../../lib/avatarUtils";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    "aria-controls": `settings-tabpanel-${index}`,
  };
}

export default function SettingsPage() {
  const router = useRouter();
  
  // Tab state
  const [tabValue, setTabValue] = useState(0);
  
  // User data state
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [userRole, setUserRole] = useState<"student" | "instructor">("student");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Profile tab states
  const [editingName, setEditingName] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Security tab states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailAuthPassword, setEmailAuthPassword] = useState("");
  const [showEmailAuthPassword, setShowEmailAuthPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  // Removed notification tab states
    // Navigation state
  const [isClient, setIsClient] = useState(false);
  const [activePage, setActivePage] = useState('settings');

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info" | "warning">("success");
  // Set isClient to true when component mounts on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Set the active page based on the current pathname
  useEffect(() => {
    if (!isClient) return;
    
    const path = window.location.pathname;
    if (path.includes('/dashboard/instructor')) {
      setActivePage('instructor');
    } else if (path.includes('/student-requests')) {
      setActivePage('student-requests');
    } else if (path.includes('/dashboard/reports')) {
      setActivePage('reports');
    } else if (path.includes('/settings')) {
      setActivePage('settings');
    }
  }, [isClient]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      
      setUserId(user.uid);
      setEmail(user.email || "");
      setFullName(user.displayName || "");
      setNewFullName(user.displayName || "");
      setNewEmail(user.email || "");
      
      if (user.photoURL) {
        setProfileImage(user.photoURL);
      }
      
      try {
        // Fetch additional user data from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Set user role
          if (userData.role) {
            setUserRole(userData.role as "student" | "instructor");
          }
          
          // Set full name if available and different from auth
          if (userData.fullName && (!user.displayName || user.displayName !== userData.fullName)) {
            setFullName(userData.fullName);
            setNewFullName(userData.fullName);
          }
          // Removed notification preferences fetching
          
          // Set profile image if available in Firestore and different from auth
          if (userData.profileImage && (!user.photoURL || user.photoURL !== userData.profileImage)) {
            setProfileImage(userData.profileImage);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        showSnackbar("Failed to load user profile data", "error");
      } finally {
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file || !userId) return;
    
    try {
      setUploadingImage(true);
      
      // Upload to MongoDB using the API
      const formData = new FormData();
      formData.append('image', file);
      formData.append('classCode', userId); // Using userId for organization
      formData.append('type', 'profile');

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const responseData = await uploadResponse.json();
      
      if (!uploadResponse.ok) {
        throw new Error(responseData.error || 'Failed to upload profile image');
      }

      if (!responseData.success || !responseData.mongoUrl) {
        throw new Error('Invalid response from upload service');
      }

      const mongoUrl = responseData.mongoUrl;
      
      // Update auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          photoURL: mongoUrl
        });
      }
        // Update Firestore - we store the MongoDB URL reference
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        profileImage: mongoUrl
      });
      
      // Update student records if this user is a student
      if (userRole === "student") {
        try {
          // Find all student records with this user's auth ID
          const studentQuery = query(
            collection(db, "students"),
            where("studentId", "==", userId)
          );
          
          const studentDocs = await getDocs(studentQuery);
          
          // Update each student record with the new profile image
          const updatePromises = studentDocs.docs.map(studentDoc => {
            return updateDoc(doc(db, "students", studentDoc.id), {
              profileImage: mongoUrl
            });
          });
          
          await Promise.all(updatePromises);
          console.log(`Updated profile image in ${updatePromises.length} student records`);
        } catch (err) {
          console.error("Error updating student records with new profile image:", err);
          // We don't show an error to the user, as the main profile update was successful
        }
      }
      
      // Update state
      setProfileImage(mongoUrl);
      
      showSnackbar("Profile picture updated successfully!", "success");
    } catch (error) {
      console.error("Error uploading image:", error);
      showSnackbar("Failed to update profile picture", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateName = async () => {
    if (!userId || !newFullName.trim()) return;
    
    try {
      setSavingProfile(true);
      
      // Update auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: newFullName
        });
      }
      
      // Update Firestore
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fullName: newFullName
      });
      
      // Update state
      setFullName(newFullName);
      setEditingName(false);
      
      showSnackbar("Name updated successfully!", "success");
    } catch (error) {
      console.error("Error updating name:", error);
      showSnackbar("Failed to update name", "error");
    } finally {
      setSavingProfile(false);
    }
  };
  
  const handleChangeEmail = async () => {
    if (!auth.currentUser || !newEmail.trim() || !emailAuthPassword.trim()) return;
    
    try {
      setChangingEmail(true);
      
      // Check if email is already in use in Firestore
      const usersRef = collection(db, "users");
      const emailQuery = query(usersRef, where("email", "==", newEmail));
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        showSnackbar("This email is already in use by another account", "error");
        setChangingEmail(false);
        return;
      }
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email || "",
        emailAuthPassword
      );
      
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update email in auth
      await updateEmail(auth.currentUser, newEmail);
      
      // Update email in Firestore
      if (userId) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          email: newEmail
        });
      }
      
      // Update state
      setEmail(newEmail);
      setEmailAuthPassword("");
      
      showSnackbar("Email updated successfully!", "success");
    } catch (error) {
      console.error("Error updating email:", error);
      showSnackbar("Failed to update email. Please check your password and try again.", "error");
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!auth.currentUser || !currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) return;
    
    if (newPassword !== confirmNewPassword) {
      showSnackbar("New passwords do not match", "error");
      return;
    }
    
    if (newPassword.length < 6) {
      showSnackbar("Password must be at least 6 characters", "error");
      return;
    }
    
    try {
      setChangingPassword(true);
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email || "",
        currentPassword
      );
      
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, newPassword);
      
      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      
      showSnackbar("Password updated successfully!", "success");
    } catch (error) {
      console.error("Error updating password:", error);
      showSnackbar("Failed to update password. Please check your current password.", "error");
    } finally {
      setChangingPassword(false);
    }
  };
  // Removed handleUpdateNotifications function

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      showSnackbar("Failed to log out", "error");
    }
  };

  const showSnackbar = (message: string, severity: "success" | "error" | "info" | "warning" = "success") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };
    const handleNavigation = (path: string) => {
    setNavigating(true);
    // Set active page based on the route
    if (path.includes('/dashboard/instructor')) {
      setActivePage('instructor');
    } else if (path.includes('/student-requests')) {
      setActivePage('student-requests');
    } else if (path.includes('/dashboard/reports')) {
      setActivePage('reports');
    } else if (path.includes('/settings')) {
      setActivePage('settings');
    }
    router.push(path);
  };

  return (
    <Box sx={{
      display: "flex",
      minHeight: "100vh",
      bgcolor: "#f4f7fd",
    }}>
      {/* Loading Overlay */}
      {navigating && <LoadingOverlay isLoading={navigating} message="Loading..." />}
      
      {/* Sidebar */}
      <Box
        sx={{
          width: { xs: '70px', md: '220px' },
          bgcolor: '#f9fafb',
          borderRight: '1px solid #e5e7eb',
          position: 'fixed',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          py: 2,
          boxShadow: '0 2px 8px 0 rgba(51,78,172,0.04)',
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <Box sx={{ px: 2, py: 2, mb: 3, display: 'flex', justifyContent: 'center' }}>
          <Box 
            component="img"
            src="/attendify.svg"
            alt="Attendify Logo"
            sx={{
              height: 40,
              width: 'auto',
              display: { xs: 'none', md: 'block' }
            }}
          />
          <Box 
            component="img"
            src="/favicon_io/android-chrome-192x192.png"
            alt="Attendify Logo"
            sx={{
              height: 32,
              width: 'auto',
              display: { xs: 'block', md: 'none' }
            }}
          />
        </Box>
        
        {/* Navigation Items */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1 }}>          <Button
            startIcon={<HomeIcon />}
            onClick={() => handleNavigation(userRole === "student" ? "/dashboard/student" : "/dashboard/instructor")}
            sx={{
              justifyContent: 'flex-start',
              color: activePage === 'instructor' ? '#334eac' : '#64748b',
              bgcolor: activePage === 'instructor' ? 'rgba(51, 78, 172, 0.07)' : 'transparent',
              borderRadius: '8px',
              py: { xs: 1, md: 1.2 },
              px: { xs: 1.2, md: 1.7 },
              minWidth: 0,
              width: '100%',
              fontWeight: 500,
              fontSize: { xs: '1rem', md: '1.05rem' },
              '&:hover': { bgcolor: activePage === 'instructor' ? 'rgba(51, 78, 172, 0.13)' : 'rgba(51, 78, 172, 0.07)' },
              '& .MuiButton-startIcon': {
                margin: 0,
                mr: { xs: 0, md: 1.5 },
                minWidth: { xs: 22, md: 'auto' }
              }
            }}
          >            <Typography
              sx={{
                display: { xs: 'none', md: 'block' },
                fontWeight: 500,
                fontFamily: 'var(--font-gilroy)',
                whiteSpace: 'nowrap'
              }}
            >
              Dashboard
            </Typography>
          </Button>
          
          {userRole === "instructor" && (
            <>              <Button
                startIcon={
                  <Badge color="error" badgeContent={pendingRequests} invisible={pendingRequests === 0} sx={{ '& .MuiBadge-badge': { fontWeight: 600, fontSize: 13, minWidth: 20, height: 20 } }}>
                    <PeopleIcon />
                  </Badge>
                }                onClick={() => handleNavigation("/student-requests")}
                sx={{
                  justifyContent: 'flex-start',
                  color: activePage === 'student-requests' ? '#334eac' : '#64748b',
                  bgcolor: activePage === 'student-requests' ? 'rgba(51, 78, 172, 0.07)' : 'transparent',
                  borderRadius: '8px',
                  py: { xs: 1, md: 1.2 },
                  px: { xs: 1.2, md: 1.7 },
                  minWidth: 0,
                  width: '100%',
                  fontWeight: 500,
                  fontSize: { xs: '1rem', md: '1.05rem' },
                  '&:hover': { bgcolor: activePage === 'student-requests' ? 'rgba(51, 78, 172, 0.13)' : 'rgba(51, 78, 172, 0.07)' },
                  '& .MuiButton-startIcon': {
                    margin: 0,
                    mr: { xs: 0, md: 1.5 },
                    minWidth: { xs: 22, md: 'auto' }
                  }
                }}
              >
                <Typography
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    fontWeight: 500,
                    fontFamily: 'var(--font-gilroy)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Student Requests
                </Typography>
              </Button>
              
              <Button
                startIcon={<DescriptionIcon />}                onClick={() => handleNavigation("/dashboard/reports")}
                sx={{
                  justifyContent: 'flex-start',
                  color: activePage === 'reports' ? '#334eac' : '#64748b',
                  bgcolor: activePage === 'reports' ? 'rgba(51, 78, 172, 0.07)' : 'transparent',
                  borderRadius: '8px',
                  py: { xs: 1, md: 1.2 },
                  px: { xs: 1.2, md: 1.7 },
                  minWidth: 0,
                  width: '100%',
                  fontWeight: 500,
                  fontSize: { xs: '1rem', md: '1.05rem' },
                  '&:hover': { bgcolor: activePage === 'reports' ? 'rgba(51, 78, 172, 0.13)' : 'rgba(51, 78, 172, 0.07)' },
                  '& .MuiButton-startIcon': {
                    margin: 0,
                    mr: { xs: 0, md: 1.5 },
                    minWidth: { xs: 22, md: 'auto' }
                  }
                }}
              >
                <Typography
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    fontWeight: 500,
                    fontFamily: 'var(--font-gilroy)'
                  }}
                >
                  Reports
                </Typography>
              </Button>
            </>
          )}
        </Box>
          {/* Bottom Navigation Items */}
        <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1, px: 1 }}>          <Button
            startIcon={<SettingsIcon />}
            sx={{
              justifyContent: 'flex-start',
              color: activePage === 'settings' ? '#334eac' : '#64748b',
              bgcolor: activePage === 'settings' ? 'rgba(51, 78, 172, 0.07)' : 'transparent',
              borderRadius: '8px',
              py: { xs: 1, md: 1.2 },
              px: { xs: 1.2, md: 1.7 },
              minWidth: 0,
              width: '100%',
              fontWeight: 500,
              fontSize: { xs: '1rem', md: '1.05rem' },
              '&:hover': { bgcolor: activePage === 'settings' ? 'rgba(51, 78, 172, 0.13)' : 'rgba(51, 78, 172, 0.07)' },
              '& .MuiButton-startIcon': { 
                margin: 0,
                mr: { xs: 0, md: 1.5 },
                minWidth: { xs: 22, md: 'auto' }
              }
            }}
          >
            <Typography
              sx={{
                display: { xs: 'none', md: 'block' },
                fontWeight: 500,
                fontFamily: 'var(--font-gilroy)'
              }}
            >
              Settings
            </Typography>
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ 
        flexGrow: 1,
        ml: { xs: '70px', md: '220px' },
        p: { xs: 2, sm: 4 },
        width: '100%',
      }}>
        {/* Header */}
        <Box sx={{ 
          display: "flex", 
          alignItems: "center", 
          mb: 4,
          maxWidth: "900px", 
          mx: "auto"
        }}>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{ 
              fontWeight: 700, 
              color: "#334eac",
              fontFamily: "var(--font-gilroy)" 
            }}
          >
            Account Settings
          </Typography>
        </Box>

        {/* Main Content */}
        {loading ? (
          <Box sx={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            height: "400px" 
          }}>
            <CircularProgress sx={{ color: "#334eac" }} />
          </Box>
        ) : (
          <Paper 
            elevation={0} 
            sx={{ 
              maxWidth: "900px", 
              mx: "auto", 
              borderRadius: "16px",
              boxShadow: "0 2px 20px rgba(0, 0, 0, 0.05)",
              overflow: "hidden"
            }}
          >
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange} 
                variant="fullWidth"
                sx={{
                  bgcolor: "#f9fafb",
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    py: 2.5,
                    textTransform: "capitalize",
                    fontSize: "1rem"
                  },
                  '& .Mui-selected': {
                    color: "#334eac"
                  },
                  '& .MuiTabs-indicator': {
                    bgcolor: "#334eac"
                  }
                }}
                aria-label="settings tabs"
              >
                <Tab 
                  icon={<PersonIcon />} 
                  iconPosition="start" 
                  label="Profile" 
                  {...a11yProps(0)} 
                />
                <Tab 
                  icon={<SecurityIcon />} 
                  iconPosition="start" 
                  label="Security" 
                  {...a11yProps(1)} 
                />
              </Tabs>
            </Box>

            {/* Profile Tab */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ textAlign: "center", mb: 4 }}>
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ position: "relative", display: "inline-block" }}>                    <Avatar
                      src={profileImage || undefined}
                      alt={fullName}
                      sx={{
                        width: 120,
                        height: 120,
                        bgcolor: !profileImage ? (fullName ? `hsl(${fullName.charCodeAt(0) * 5}, 70%, 60%)` : '#334eac') : undefined,
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '3rem',
                        boxShadow: "0 2px 15px rgba(0, 0, 0, 0.1)",
                        border: "4px solid white"
                      }}
                    >
                      {getInitials(fullName)}
                    </Avatar>
                    <label htmlFor="profile-image-upload">
                      <input
                        id="profile-image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: "none" }}
                        disabled={uploadingImage}
                      />
                      <IconButton
                        component="span"
                        sx={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          bgcolor: "#334eac",
                          color: "white",
                          "&:hover": { bgcolor: "#22357a" }
                        }}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? (
                          <CircularProgress size={20} sx={{ color: "white" }} />
                        ) : (
                          <AddAPhotoIcon />
                        )}
                      </IconButton>
                    </label>
                  </Box>
                </Box>
                
                <Typography variant="h6" fontWeight={700} sx={{ fontFamily: "var(--font-gilroy)" }}>
                  {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Account
                </Typography>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                  Full Name
                </Typography>
                {editingName ? (
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <TextField
                      fullWidth
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="Your full name"
                      variant="outlined"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px'
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleUpdateName}
                      disabled={savingProfile}
                      startIcon={savingProfile ? <CircularProgress size={20} /> : <SaveIcon />}
                      sx={{
                        bgcolor: "#334eac",
                        "&:hover": { bgcolor: "#22357a" },
                        borderRadius: "8px",
                        boxShadow: "none",
                        textTransform: "none"
                      }}
                    >
                      Save
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body1" fontWeight={500} sx={{ fontSize: "1.1rem" }}>
                      {fullName}
                    </Typography>
                    <IconButton onClick={() => setEditingName(true)} size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                  Email Address
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ fontSize: "1.1rem" }}>
                  {email}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  To change your email address, go to the Security tab
                </Typography>
              </Box>
            </TabPanel>

            {/* Security Tab */}
            <TabPanel value={tabValue} index={1}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 3, fontFamily: "var(--font-gilroy)" }}>
                Change Email Address
              </Typography>

              <Box sx={{ mb: 4 }}>
                <TextField
                  fullWidth
                  label="New Email Address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  variant="outlined"
                  type="email"
                  margin="normal"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px'
                    }
                  }}
                />
                <TextField
                  fullWidth
                  label="Current Password"
                  value={emailAuthPassword}
                  onChange={(e) => setEmailAuthPassword(e.target.value)}
                  variant="outlined"
                  type={showEmailAuthPassword ? "text" : "password"}
                  margin="normal"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowEmailAuthPassword(!showEmailAuthPassword)}
                          edge="end"
                        >
                          {showEmailAuthPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px'
                    }
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleChangeEmail}
                  disabled={changingEmail || !newEmail || !emailAuthPassword}
                  fullWidth
                  sx={{
                    mt: 2,
                    bgcolor: "#334eac",
                    "&:hover": { bgcolor: "#22357a" },
                    borderRadius: "8px",
                    py: 1.2,
                    boxShadow: "none",
                    textTransform: "none"
                  }}
                >
                  {changingEmail ? (
                    <CircularProgress size={24} sx={{ color: "white" }} />
                  ) : (
                    "Update Email"
                  )}
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" fontWeight={700} sx={{ mb: 3, fontFamily: "var(--font-gilroy)" }}>
                Change Password
              </Typography>

              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  variant="outlined"
                  type={showCurrentPassword ? "text" : "password"}
                  margin="normal"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          edge="end"
                        >
                          {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px'
                    }
                  }}
                />
                <TextField
                  fullWidth
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  variant="outlined"
                  type={showNewPassword ? "text" : "password"}
                  margin="normal"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                        >
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px'
                    }
                  }}
                />
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  variant="outlined"
                  type={showConfirmPassword ? "text" : "password"}
                  margin="normal"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px'
                    }
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleChangePassword}
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                  fullWidth
                  sx={{
                    mt: 2,
                    bgcolor: "#334eac",
                    "&:hover": { bgcolor: "#22357a" },
                    borderRadius: "8px",
                    py: 1.2,
                    boxShadow: "none",
                    textTransform: "none"
                  }}
                >
                  {changingPassword ? (
                    <CircularProgress size={24} sx={{ color: "white" }} />
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </Box>
            </TabPanel>            
            {/* Notifications Tab removed */}
          </Paper>
        )}

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={5000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert 
            onClose={() => setSnackbarOpen(false)} 
            severity={snackbarSeverity} 
            sx={{ width: "100%", borderRadius: "8px" }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}
