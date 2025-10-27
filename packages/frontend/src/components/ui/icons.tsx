import React from 'react';

// 🎨 **SOVREN ICON SYSTEM** - Professional SVG icons matching brand sophistication

export interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

// ⚡ **LIGHTNING NETWORK** - Professional Bitcoin icon
export const LightningIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13 2L4.09 12.97C3.74 13.47 4.08 14.09 4.65 14.09H8L7 22L15.91 11.03C16.26 10.53 15.92 9.91 15.35 9.91H12L13 2Z"
      fill="url(#lightning-gradient)"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="lightning-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FCD34D" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
  </svg>
);

// 🔐 **SOVEREIGN IDENTITY** - NOSTR key icon
export const SovereignIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C13.1 2 14 2.9 14 4V8C15.1 8 16 8.9 16 10V16C16 17.1 15.1 18 14 18H6C4.9 18 4 17.1 4 16V10C4 8.9 4.9 8 6 8V4C6 2.9 6.9 2 8 2H12Z"
      fill="url(#sovereign-gradient)"
      stroke={color}
      strokeWidth="1.5"
    />
    <circle cx="10" cy="13" r="2" fill="white" />
    <path d="M8 8V4C8 3.4 8.4 3 9 3H11C11.6 3 12 3.4 12 4V8" stroke="white" strokeWidth="1.5" />
    <defs>
      <linearGradient id="sovereign-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
  </svg>
);

// 👑 **PREMIUM ELITE** - Crown icon
export const PremiumIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 16L3 4L8.5 9L12 2L15.5 9L21 4L19 16H5Z"
      fill="url(#premium-gradient)"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 16H19V18C19 19.1 18.1 20 17 20H7C5.9 20 5 19.1 5 18V16Z"
      fill="url(#premium-gradient)"
    />
    <defs>
      <linearGradient id="premium-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6B7280" />
        <stop offset="100%" stopColor="#111827" />
      </linearGradient>
    </defs>
  </svg>
);

// 🔄 **LOADING SPINNER** - Professional animated loader
export const LoadingIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeDasharray="31.416"
      strokeDashoffset="31.416"
      fill="none"
      opacity="0.2"
    />
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeDasharray="31.416"
      strokeDashoffset="23.562"
      fill="none"
      className="animate-pulse"
    />
  </svg>
);

// ✅ **SUCCESS** - Check mark
export const SuccessIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = '#10B981',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 6L9 17L4 12"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ⚠️ **WARNING** - Alert triangle
export const WarningIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = '#F59E0B',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 9V13M12 17H12.01M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ❌ **ERROR** - X mark in circle
export const ErrorIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = '#EF4444',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <path d="M15 9L9 15M9 9L15 15" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 🔍 **SEARCH** - Professional search icon
export const SearchIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" />
    <path d="M21 21L16.65 16.65" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 👤 **USER** - Profile icon
export const UserIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.21 14.21 11 12 11C9.79 11 8 9.21 8 7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 📧 **EMAIL** - Mail icon
export const EmailIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="22,6 12,13 2,6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 💰 **SATS** - Bitcoin/Satoshi icon
export const SatsIcon: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <path
      d="M14.5 8.5C14.5 7.12 13.38 6 12 6C10.62 6 9.5 7.12 9.5 8.5C9.5 9.88 10.62 11 12 11C13.38 11 14.5 12.12 14.5 13.5C14.5 14.88 13.38 16 12 16C10.62 16 9.5 14.88 9.5 13.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M12 4V6M12 16V20" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ⚡ **ZAP** - Lightning bolt
export const Zap: React.FC<IconProps> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <polygon
      points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 🌍 **GLOBE** - Global/worldwide
export const Globe: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="2" />
    <path
      d="M12 2C16.5 7 16.5 17 12 22M12 2C7.5 7 7.5 17 12 22"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// 🔑 **KEY** - Security/authentication
export const Key: React.FC<IconProps> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 2L19 4L15 8L12.5 5.5L11 7L13 9L12 10L10 8L8.5 9.5L11 12L10 13L4 7L8 3C10.2091 0.7909 13.7909 0.7909 16 3C18.2091 5.2091 18.2091 8.7909 16 11L21 2Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="8" r="2" stroke={color} strokeWidth="2" />
  </svg>
);

// 🛡️ **SHIELD** - Protection/security
export const Shield: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 22C12 22 20 16 20 10V6L12 2L4 6V10C4 16 12 22 12 22Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 📈 **TRENDING UP** - Growth/analytics
export const TrendingUp: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <polyline
      points="23,6 13.5,15.5 8.5,10.5 1,18"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="17,6 23,6 23,12"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 👥 **USERS** - Community/people
export const Users: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" />
    <path
      d="M23 21V19C23 16.7909 21.2091 15 19 15C17.0238 15 15.3175 16.253 14.7717 18"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="7" r="4" stroke={color} strokeWidth="2" />
  </svg>
);

// 💰 **DOLLAR SIGN** - Money/currency
export const DollarSign: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <line x1="12" y1="1" x2="12" y2="23" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path
      d="M17 5H9.5C8.11929 5 7 6.11929 7 7.5C7 8.88071 8.11929 10 9.5 10H14.5C15.8807 10 17 11.1193 17 12.5C17 13.8807 15.8807 15 14.5 15H6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 📊 **BAR CHART 3** - Analytics/charts
export const BarChart3: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 3V21H21"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 16L12 11L16 15L21 10"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 📈 **TRENDING DOWN** - Decrease/decline
export const TrendingDown: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <polyline
      points="23,18 13.5,8.5 8.5,13.5 1,6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="17,18 23,18 23,12"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ⚡ **ACTIVITY** - Real-time activity
export const Activity: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <polyline
      points="22,12 18,12 15,21 9,3 6,12 2,12"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 🔄 **REFRESH CW** - Refresh/reload
export const RefreshCw: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <polyline
      points="23,4 23,10 17,10"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="1,20 1,14 7,14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20.49,9C19.8,6.3 17.4,4.1 14.5,3.3C11.2,2.4 7.7,3.6 5.6,6.1L1,10"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.51,15C4.2,17.7 6.6,19.9 9.5,20.7C12.8,21.6 16.3,20.4 18.4,17.9L23,14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 📥 **DOWNLOAD** - Download action
export const Download: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="8,10 12,14 16,10"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="12" y1="14" x2="12" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 👁️ **EYE** - View/visibility
export const Eye: React.FC<IconProps> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
  </svg>
);

// 🎯 **TARGET** - Goals/targeting
export const Target: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="2" />
    <circle cx="12" cy="12" r="2" stroke={color} strokeWidth="2" />
  </svg>
);

// ⚠️ **ALERT CIRCLE** - Alert/warning
export const AlertCircle: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <line x1="12" y1="8" x2="12" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="16" x2="12.01" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 💡 **LIGHTBULB** - Ideas/insights
export const Lightbulb: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 21H15M12 3C8.68629 3 6 5.68629 6 9C6 11.0323 7.01099 12.8204 8.5 13.8V16H15.5V13.8C16.989 12.8204 18 11.0323 18 9C18 5.68629 15.3137 3 12 3Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 📊 **SIMPLE CHART** - Basic chart component
export const SimpleChart: React.FC<IconProps> = ({
  size = 20,
  className = '',
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <line x1="18" y1="20" x2="18" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="20" x2="12" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="6" y1="20" x2="6" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Export all icons for easy importing
export const Icons = {
  Lightning: LightningIcon,
  Sovereign: SovereignIcon,
  Premium: PremiumIcon,
  Loading: LoadingIcon,
  Success: SuccessIcon,
  Warning: WarningIcon,
  Error: ErrorIcon,
  Search: SearchIcon,
  User: UserIcon,
  Email: EmailIcon,
  Sats: SatsIcon,
  Zap,
  Globe,
  Key,
  Shield,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  TrendingDown,
  Activity,
  RefreshCw,
  Download,
  Eye,
  Target,
  AlertCircle,
  Lightbulb,
  SimpleChart,
};
