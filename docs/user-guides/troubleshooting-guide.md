# 🔧 Browser Extension Troubleshooting Guide

**For Sovren Users**
**Version**: 1.0.0
**Last Updated**: January 20, 2025

## 🎯 **Quick Fix Checklist**

Before diving into specific issues, try these quick fixes first:

- [ ] **Refresh the page** (Ctrl+F5 or Cmd+Shift+R)
- [ ] **Check extension is installed** (look for icon in browser toolbar)
- [ ] **Ensure extension is enabled** (check browser extension settings)
- [ ] **Clear browser cache** (Ctrl+Shift+Delete)
- [ ] **Disable other extensions** temporarily to check for conflicts
- [ ] **Try incognito/private mode** to rule out browser issues

---

## 🚨 **Common Issues & Solutions**

### **1. Extension Not Detected**

#### **Symptoms:**

- "No NOSTR extension detected" message
- Extension icon visible but not connecting
- Sovren shows fallback authentication only

#### **Solutions:**

**Step 1: Verify Extension Installation**

```bash
# Check if extension is installed:
1. Look for nos2x or Alby icon in browser toolbar
2. If missing, reinstall from official store
3. Ensure extension is enabled in browser settings
```

**Step 2: Check Domain Permissions**

```bash
# For nos2x:
1. Click nos2x icon → Settings
2. Check if sovren.app is in allowed domains
3. Add sovren.app manually if missing

# For Alby:
1. Click Alby icon → Settings → Applications
2. Look for sovren.app in connected apps
3. Reconnect if missing or revoked
```

**Step 3: Browser-Specific Fixes**

**Chrome/Edge:**

```bash
1. Go to chrome://extensions/
2. Find your NOSTR extension
3. Ensure "Enable" toggle is ON
4. Check "Allow in incognito" if needed
```

**Firefox:**

```bash
1. Go to about:addons
2. Find your NOSTR extension
3. Ensure it's "Enabled"
4. Check permissions in extension details
```

**Safari:**

```bash
1. Safari → Preferences → Extensions
2. Enable your NOSTR extension
3. Check website access permissions
```

---

### **2. Connection Timeout Errors**

#### **Symptoms:**

- "Connection timeout" error message
- Extension detected but fails to connect
- Long loading times with no response

#### **Solutions:**

**Step 1: Wait and Retry**

```bash
# Extensions can be slow to load
1. Wait 10-15 seconds before clicking anything
2. Close extension popup and reopen
3. Refresh page and try again
```

**Step 2: Check Extension Status**

```bash
# Verify extension is responsive:
1. Click extension icon directly
2. Try accessing extension settings
3. Test with other NOSTR websites
```

**Step 3: Clear Extension Data**

```bash
# For nos2x:
1. Right-click extension icon
2. Options → Reset/Clear data
3. Reconfigure with your private key

# For Alby:
1. Alby Settings → Advanced
2. Reset connection data
3. Re-authorize applications
```

---

### **3. Permission Denied Errors**

#### **Symptoms:**

- "Permission denied" or "User rejected" messages
- Extension popup appears but closes immediately
- Authorization prompts not appearing

#### **Solutions:**

**Step 1: Manual Authorization**

```bash
1. Click extension icon in toolbar
2. Look for sovren.app in connected apps
3. Manually grant permissions if needed
4. Ensure "Sign events" permission is enabled
```

**Step 2: Reset Extension Permissions**

```bash
# For nos2x:
1. nos2x icon → Settings
2. Remove sovren.app from domains
3. Visit sovren.app and re-authorize

# For Alby:
1. Alby → Settings → Applications
2. Remove sovren.app connection
3. Reconnect through Sovren login
```

**Step 3: Check Browser Permissions**

```bash
1. Browser Settings → Privacy & Security
2. Site Settings → Permissions
3. Ensure sovren.app has required permissions
4. Clear any blocked permissions for sovren.app
```

---

### **4. Slow Response Times**

#### **Symptoms:**

- Extension takes >5 seconds to respond
- Browser becomes unresponsive during connection
- Timeouts after initial connection

#### **Solutions:**

**Step 1: Optimize Browser Performance**

```bash
1. Close unnecessary tabs and applications
2. Restart browser to clear memory
3. Update browser to latest version
4. Disable resource-heavy extensions temporarily
```

**Step 2: Check Extension Performance**

```bash
# Monitor extension behavior:
1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for extension-related errors
4. Note any timeout or performance warnings
```

**Step 3: Network Troubleshooting**

```bash
1. Check internet connection stability
2. Disable VPN temporarily if using one
3. Try different network (mobile hotspot)
4. Check if firewall is blocking connections
```

---

### **5. Key Management Issues**

#### **Symptoms:**

- "Invalid private key" errors
- Public key mismatch warnings
- Unable to sign events or messages

#### **Solutions:**

**Step 1: Verify Private Key Format**

```bash
# NOSTR private keys should be:
- 64 characters long (hex format)
- Valid secp256k1 private key
- Not your Bitcoin private key (different format)

Example valid format: a1b2c3d4e5f6....(64 hex characters total)
```

**Step 2: Reset Extension Keys**

```bash
# For nos2x:
1. Backup current private key first
2. nos2x Settings → Delete current key
3. Import or generate new key
4. Test connection with Sovren

# For Alby:
1. Alby Settings → NOSTR tab
2. Remove current NOSTR key
3. Generate new key or import existing
4. Re-authorize with Sovren
```

**Step 3: Key Security Check**

```bash
# Verify key integrity:
1. Test private key with other NOSTR clients
2. Ensure key hasn't been compromised
3. Generate fresh key if needed
4. Update all connected applications
```

---

### **6. Multiple Extension Conflicts**

#### **Symptoms:**

- Two extensions detected but connection fails
- Incorrect extension selected automatically
- Switching between extensions doesn't work

#### **Solutions:**

**Step 1: Disable Conflicting Extensions**

```bash
1. Identify all NOSTR extensions installed
2. Disable all except your preferred one
3. Test connection with single extension
4. Re-enable others one by one if needed
```

**Step 2: Clear Extension Selection**

```bash
1. Clear browser cache and cookies
2. Remove all NOSTR extension permissions
3. Start fresh with preferred extension
4. Configure one extension at a time
```

**Step 3: Priority Configuration**

```bash
# Set extension priority in Sovren:
1. Disconnect all extensions first
2. Connect your preferred extension
3. Test functionality thoroughly
4. Add secondary extension if needed
```

---

## 🔍 **Diagnostic Tools**

### **Browser Developer Tools**

**Check Console for Errors:**

```javascript
// Open browser console (F12) and look for:
- NOSTR extension errors
- Permission denied messages
- Network connection issues
- JavaScript errors related to extensions
```

**Monitor Network Requests:**

```javascript
// In Network tab, check for:
- Failed requests to extension APIs
- Timeout errors
- CORS (Cross-Origin) issues
- WebSocket connection problems
```

### **Extension Status Checking**

**nos2x Diagnostics:**

```javascript
// Check nos2x status in console:
console.log(window.nostr); // Should show nostr object
console.log(window.nostr.getPublicKey); // Should show function
```

**Alby Diagnostics:**

```javascript
// Check Alby status in console:
console.log(window.webln); // Should show WebLN object
console.log(window.nostr); // Should show NOSTR object for Alby
```

---

## 🛠 **Advanced Troubleshooting**

### **Extension Reinstallation**

**Complete Clean Reinstall:**

```bash
1. Export/backup your private keys first
2. Uninstall extension completely
3. Clear browser data for extension
4. Restart browser
5. Install extension from official store
6. Import keys and reconfigure
7. Test with Sovren
```

### **Browser Reset (Last Resort)**

**Chrome/Edge Reset:**

```bash
1. chrome://settings/reset
2. Reset settings to original defaults
3. Reinstall extensions
4. Reconfigure everything
```

**Firefox Reset:**

```bash
1. about:support
2. Refresh Firefox button
3. Reinstall extensions
4. Reconfigure settings
```

---

## 📱 **Mobile-Specific Issues**

### **Limited Mobile Support**

**Current Limitations:**

- iOS Safari: Very limited extension support
- Android Chrome: Some extensions work in developer mode
- Mobile browsers: Generally don't support desktop extensions

**Recommended Solutions:**

```bash
1. Use desktop browser for full functionality
2. Install dedicated mobile NOSTR apps:
   - Damus (iOS)
   - Amethyst (Android)
   - Iris (web-based)
3. Use Sovren's fallback authentication on mobile
4. Generate QR codes for mobile authentication
```

---

## 🚨 **Emergency Recovery Procedures**

### **If You Lost Access to Your Account**

**Step 1: Check Private Key Backup**

```bash
1. Locate your private key backup
2. Import key into working extension
3. Test key with other NOSTR clients
4. Contact support if key is lost
```

**Step 2: Account Recovery Options**

```bash
1. Use backup authentication methods
2. Contact Sovren support with account details
3. Verify identity through alternative means
4. Generate new NOSTR identity if necessary
```

### **If Extension is Compromised**

**Immediate Actions:**

```bash
1. Disconnect extension from all websites
2. Revoke all application permissions
3. Generate new private key immediately
4. Update connected accounts with new public key
5. Report security incident to extension developers
```

---

## 📞 **Getting Additional Help**

### **Self-Service Resources**

- **Setup Guide**: [Browser Extension Setup Guide](browser-extension-setup-guide.md)
- **Feature Documentation**: [Browser Extension Integration](../features/browser-extension-integration.md)
- **Developer Docs**: [Extension Integration Developer Guide](extension-integration-developer-guide.md)

### **Community Support**

- **Discord**: Join Sovren Discord for peer support
- **NOSTR**: Post questions with #sovren hashtag
- **Reddit**: r/nostr community discussions

### **Official Support**

- **Email**: support@sovren.app
- **Response Time**: 24-48 hours for most issues
- **Priority Support**: Available for premium users

### **Extension-Specific Support**

- **nos2x Issues**: [GitHub Issues](https://github.com/fiatjaf/nos2x/issues)
- **Alby Issues**: [Alby Support](https://alby.com/support)
- **Browser Issues**: Your browser's official support channels

---

## 📊 **Issue Tracking Template**

When contacting support, please include:

```markdown
**Issue Description**: [Brief description of the problem]

**Browser & Version**: [e.g., Chrome 118.0.5993.70]

**Extension & Version**: [e.g., nos2x 1.9.0 or Alby 2.15.0]

**Operating System**: [e.g., Windows 11, macOS 13.5, Ubuntu 22.04]

**Steps to Reproduce**:

1. [First step]
2. [Second step]
3. [Third step]

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happens]

**Error Messages**: [Exact error text]

**Console Errors**: [Any JavaScript errors from browser console]

**Screenshots**: [If applicable]

**Already Tried**: [Solutions you've already attempted]
```

---

## ✅ **Prevention Tips**

### **Regular Maintenance**

- ✅ **Update extensions** regularly through browser extension manager
- ✅ **Backup private keys** securely and regularly
- ✅ **Review connected applications** monthly
- ✅ **Test extension functionality** periodically
- ✅ **Keep browser updated** to latest version

### **Security Hygiene**

- ✅ **Use strong browser passwords** and enable sync encryption
- ✅ **Enable two-factor authentication** where available
- ✅ **Regular security audits** of connected applications
- ✅ **Monitor for suspicious activity** in extension logs
- ✅ **Use reputable extensions** from official stores only

---

**Still having issues?** Don't hesitate to reach out to our support team at support@sovren.app with the issue tracking template above. We're here to help!
