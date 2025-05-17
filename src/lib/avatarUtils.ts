/**
 * Avatar utility functions for consistent avatar styling and behavior across the application
 */

/**
 * Generates a deterministic background color based on a name
 * @param name - The name to generate a color for
 * @returns A CSS HSL color string
 */
export const getAvatarColor = (name: string): string => {
  if (!name || name.length === 0) {
    // Default color if no name is provided
    return 'hsl(210, 70%, 60%)';
  }
  
  // Get the first character of the name and convert to a number for deterministic color
  const charCode = name.charCodeAt(0);
  // Multiply by 5 to spread the colors across the spectrum
  return `hsl(${charCode * 5}, 70%, 60%)`;
};

/**
 * Gets the initials from a name
 * @param name - The full name to get initials from
 * @returns The first character of the name in uppercase, or initials from first and last name
 */
export const getInitials = (name: string): string => {
  if (!name || name.length === 0) {
    return 'A'; // Default initial if no name is provided
  }
  
  // If the name has multiple parts (first and last name)
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length > 1) {
    // Get first letter of first and last name
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  }
  
  // Otherwise just return the first character
  return name.charAt(0).toUpperCase();
};

/**
 * Common avatar styling props for consistent avatars across the app
 * @param name - The name to use for color generation
 * @param hasProfileImage - Whether the user has a profile image
 * @param size - Size modifier for the avatar (small, medium, large)
 * @returns Style object for MUI Avatar component
 */
export const getAvatarStyles = (
  name: string,
  hasProfileImage: boolean,
  size: 'small' | 'medium' | 'large' = 'medium'
) => {
  // Size mapping
  const sizeMap = {
    small: { width: 30, height: 30, fontSize: '0.875rem' },
    medium: { width: 38, height: 38, fontSize: '1rem' },
    large: { width: 44, height: 44, fontSize: '1.25rem' },
  };
  
  const { width, height, fontSize } = sizeMap[size];
  
  return {
    width,
    height,
    mr: 1.5,
    bgcolor: !hasProfileImage ? getAvatarColor(name) : undefined,
    color: 'white',
    fontWeight: 500,
    fontSize,
    border: !hasProfileImage ? '1px solid rgba(255,255,255,0.2)' : 'none'
  };
};
