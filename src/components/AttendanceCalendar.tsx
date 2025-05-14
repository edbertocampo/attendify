import React, { useState } from 'react';
import { Box, Typography, Modal, IconButton, Card, CardActionArea } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';

interface AttendanceEntry {
  date: string; // Format: 'YYYY-MM-DD'
  type: 'image' | 'file';
  url: string;
  fileName?: string;
  geolocation?: { latitude: number; longitude: number } | null;
}

interface AttendanceCalendarProps {
  year: number;
  month: number; // 1-based (1 = January)
  entries: AttendanceEntry[];
}

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month, 0).getDate();
};

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ year: initialYear, month: initialMonth, entries }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const daysInMonth = getDaysInMonth(year, month);
  const today = new Date();
  
  // Create local state for entries that might need URL fixing
  const [fixedEntries, setFixedEntries] = useState<AttendanceEntry[]>(entries);
  
  // Map entries by date for quick lookup
  const entryMap = React.useMemo(() => {
    const map: Record<string, AttendanceEntry> = {};
    fixedEntries.forEach(e => { map[e.date] = e; });
    return map;
  }, [fixedEntries]);
  
  // Fix relative URLs by ensuring they have the origin prefix
  React.useEffect(() => {
    if (typeof window === 'undefined') return; // Only run on client side
    
    console.log('Calendar entries before fixing:', entries);
    console.log('File entries:', entries.filter(e => e.type === 'file'));
    
    // Check each entry and make sure file URLs are absolute
    const newFixedEntries = entries.map(entry => {
      // Handle file URLs consistently
      if (entry.type === 'file' && typeof entry.url === 'string') {
        console.log(`Processing file entry: ${entry.date}, URL: ${entry.url}, fileName: ${entry.fileName || 'unnamed'}`);
        
        // If empty URL, skip processing
        if (!entry.url) {
          console.log('Empty URL found, skipping:', entry);
          return entry;
        }
        
        // For relative paths that need to be made absolute
        if (entry.url.startsWith('/')) {
          // Check if this is an API route to MongoDB or a Firebase Storage URL
          console.log(`Fixing URL: ${entry.url} to ${window.location.origin}${entry.url}`);
          return {
            ...entry,
            url: `${window.location.origin}${entry.url}`
          };
        }
        
        // For Firebase storage URLs that don't start with http
        if (!entry.url.startsWith('http') && !entry.url.startsWith('/')) {
          // This could be a Firebase storage URL that needs to be handled differently
          console.log(`Fixing potential Firebase URL: ${entry.url}`);
          // If it's a MongoDB ID directly, transform it to the API route
          if (entry.url.match(/^[0-9a-f]{24}$/)) {
            const apiUrl = `/api/files/${entry.url}`;
            console.log(`Detected MongoDB ID, converting to API route: ${apiUrl}`);
            return {
              ...entry,
              url: `${window.location.origin}${apiUrl}`
            };
          }
          return entry;
        }
      }
      return entry;
    });
    
    // Update our local state with fixed entries
    setFixedEntries(newFixedEntries);
    console.log('Calendar entries after fixing:', newFixedEntries);
    
    // Log the entry map for debugging
    setTimeout(() => {
      console.log('EntryMap keys:', Object.keys(entryMap));
      console.log('Fixed entries dates:', newFixedEntries.map(e => e.date));
    }, 500);
  }, [entries]);

  // Generate calendar grid (start on Sunday)
  const firstDay = new Date(year, month - 1, 1).getDay();
  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(null); // Empty cells before 1st
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }
  // Navigation handlers
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(y => y - 1);
      setMonth(12);
    } else {
      setMonth(m => m - 1);
    }
  };
  const handleNextMonth = () => {
    if (month === 12) {
      setYear(y => y + 1);
      setMonth(1);
    } else {
      setMonth(m => m + 1);
    }
  };

  // Modal content helpers
  const selectedEntry = selectedDate ? entryMap[selectedDate] : null;
  
  // Log the selected entry when it changes for debugging
  React.useEffect(() => {
    if (selectedEntry) {
      console.log('Selected entry:', selectedEntry);
      console.log('Entry type:', selectedEntry.type);
      console.log('Entry URL:', selectedEntry.url);
    }
  }, [selectedEntry]);

  // Fetch place name when modal opens and geolocation is present
  React.useEffect(() => {
    if (selectedDate && selectedEntry && selectedEntry.geolocation) {
      setIsLocating(true);
      setPlaceName(null);
      const fetchPlaceName = async (lat: number, lon: number) => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
          );
          if (!response.ok) return null;
          const data = await response.json();
          return data.display_name || null;
        } catch {
          return null;
        }
      };
      fetchPlaceName(selectedEntry.geolocation.latitude, selectedEntry.geolocation.longitude)
        .then(name => setPlaceName(name))
        .finally(() => setIsLocating(false));
    } else {
      setPlaceName(null);
      setIsLocating(false);
    }
  }, [selectedDate, selectedEntry]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <IconButton
          onClick={handlePrevMonth}
          aria-label="Previous month"
          sx={{
            border: '2px solid #e0e0e0',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            background: '#fff',
            width: 40,
            height: 40,
            transition: 'box-shadow 0.2s',
            '&:hover': {
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              background: '#f5f5f5',
            },
          }}
        >
          {'<'}
        </IconButton>        <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', color: '#334eac', fontWeight: 600 }}>
          {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Typography>
        <IconButton
          onClick={handleNextMonth}
          aria-label="Next month"
          sx={{
            border: '2px solid #e0e0e0',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            background: '#fff',
            width: 40,
            height: 40,
            transition: 'box-shadow 0.2s',
            '&:hover': {
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              background: '#f5f5f5',
            },
          }}
        >
          {'>'}
        </IconButton>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(7, minmax(36px, 1fr))', sm: 'repeat(7, 1fr)' },
          gap: { xs: 1, sm: 2 },
          bgcolor: '#f8f9fa',
          borderRadius: 3,
          p: { xs: 1, sm: 2 },
          overflowX: { xs: 'auto', sm: 'unset' },
          minWidth: { xs: 350, sm: 'unset' },
          maxWidth: '100vw',
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <Typography key={day} align="center" fontWeight={600} color="#334eac" sx={{ fontSize: { xs: 12, sm: 16 } }}>{day}</Typography>
        ))}
        {calendarCells.map((cell, idx) => {
          if (!cell) return <Box key={idx} />;
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(cell).padStart(2, '0')}`;
          const entry = entryMap[dateStr];
          const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === cell;
          return (
            <Card
              key={dateStr}
              sx={{
                borderRadius: 3,
                boxShadow: entry ? '0 2px 8px rgba(51,78,172,0.10)' : 'none',
                border: isToday ? '2px solid #334eac' : '1px solid #e0e0e0',
                bgcolor: entry ? '#eaf0ff' : '#fff',
                minHeight: { xs: 48, sm: 80 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
              }}
              elevation={entry ? 3 : 0}
              onClick={() => setSelectedDate(dateStr)}
            >
              {entry && (
                <Box sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 0,
                  borderRadius: 3,
                  overflow: 'hidden',
                  pointerEvents: 'none',
                }}>
                  {entry.type === 'image' ? (
                    <img
                      src={entry.url}
                      alt="Preview"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.45,
                        filter: 'blur(0.5px)',
                      }}
                    />
                  ) : null}
                </Box>
              )}
              <CardActionArea
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: { xs: 0.5, sm: 1 },
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <Typography variant="body1" fontWeight={600} color={isToday ? '#334eac' : '#222'} sx={{ fontSize: { xs: 14, sm: 18 }, textShadow: entry ? '0 1px 6px #fff, 0 1px 6px #fff' : 'none', position: 'relative', zIndex: 2 }}>
                  {cell}
                </Typography>
                {entry && entry.type === 'file' && (
                  <Box sx={{ mt: 0.5, position: 'relative', zIndex: 2 }}>
                    <InsertDriveFileIcon color="action" fontSize="small" />
                  </Box>
                )}
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
      {/* Modal Preview */}
      <Modal
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 3,
            p: 3,
            minWidth: 320,
            maxWidth: '90vw',
            maxHeight: '90vh',
            boxShadow: 24,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <IconButton
            onClick={() => setSelectedDate(null)}
            sx={{ position: 'absolute', top: 8, right: 8 }}
            aria-label="Close preview"
          >
            <CloseIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ mb: 2, color: '#222' }}>
            {selectedDate}
          </Typography>
          {selectedEntry ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              {selectedEntry.geolocation && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body1" color="text.primary">
                    Geotag: {selectedEntry.geolocation.latitude}, {selectedEntry.geolocation.longitude}
                  </Typography>
                  {isLocating ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">Translating location...</Typography>
                    </Box>
                  ) : placeName ? (
                    <Box sx={{
                      mt: 1,
                      maxWidth: 260,
                      whiteSpace: 'pre-line',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      textAlign: 'center',
                      cursor: 'pointer',
                    }} title={placeName}>
                      <Typography variant="body2" color="text.secondary">
                        Location: <b>{placeName}</b>
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              )}
              {selectedEntry.type === 'image' ? (
                <img
                  src={selectedEntry.url}
                  alt="Attendance Preview"
                  style={{
                    maxWidth: '70vw',
                    maxHeight: '60vh',
                    borderRadius: 12,
                    boxShadow: '0 2px 12px rgba(51,78,172,0.10)',
                  }}
                />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <InsertDriveFileIcon color="primary" sx={{ fontSize: 60 }} />
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {selectedEntry.fileName || 'File'}
                  </Typography>
                  {/* Only render the link if we have a valid URL */}
                  {selectedEntry.url && (
                    <a
                      href={
                        // Ensure URL is absolute by adding origin if needed
                        typeof selectedEntry.url === 'string' && selectedEntry.url.startsWith('/') && typeof window !== 'undefined'
                          ? `${window.location.origin}${selectedEntry.url}`
                          : selectedEntry.url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#334eac', fontWeight: 600 }}
                      onClick={(e) => {
                        // Log the URL being opened for debugging
                        console.log('Opening file URL:', selectedEntry.url);
                        
                        // For Firebase Storage URLs, prevent default and fetch via API if needed
                        if (typeof selectedEntry.url === 'string' && 
                            !selectedEntry.url.startsWith('http') && 
                            !selectedEntry.url.startsWith('/')) {
                          console.log('This appears to be a Firebase Storage URL, might need special handling');
                        }
                      }}
                    >
                      Open File
                    </a>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1" color="text.secondary">
                No submission for this date.
              </Typography>
            </Box>
          )}
        </Box>
      </Modal>
    </Box>
  );
};

export default AttendanceCalendar;
