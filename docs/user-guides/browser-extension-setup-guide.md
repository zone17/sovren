# 🔧 NOSTR Browser Extension Setup Guide

**For Sovren Users**
**Version**: 1.0.0
**Last Updated**: January 20, 2025

## 🎯 **Overview**

This guide will help you set up and use NOSTR browser extensions with Sovren for seamless authentication and Lightning Network payments. Follow these step-by-step instructions to get started with popular extensions like nos2x and Alby.

## 📋 **Prerequisites**

- Modern web browser (Chrome, Firefox, Safari, or Edge)
- Basic understanding of cryptocurrency and Lightning Network (for Alby)
- NOSTR private key (we'll help you generate one if needed)

## 🌟 **Supported Extensions**

### **1. nos2x - NOSTR Extension**

**Best for**: General NOSTR authentication and signing
**Features**:

- ✅ Public key management
- ✅ Event signing
- ✅ NIP-04 encryption
- ✅ Multiple key support

### **2. Alby - Lightning & NOSTR Extension**

**Best for**: Lightning payments + NOSTR authentication
**Features**:

- ✅ Lightning Network payments
- ✅ NOSTR authentication
- ✅ WebLN protocol support
- ✅ Wallet management
- ✅ NIP-04/NIP-44 encryption

### **3. Generic NIP-07 Extensions**

**Compatible with**: Any NIP-07 compliant NOSTR extension
**Features**:

- ✅ Standard NOSTR methods
- ✅ Basic authentication
- ✅ Event signing

---

## 🚀 **Setup Instructions**

### **Option 1: nos2x Extension Setup**

#### **Step 1: Install nos2x**

1. **Chrome/Edge Users**:
   - Go to [Chrome Web Store](https://chrome.google.com/webstore)
   - Search for "nos2x"
   - Click "Add to Chrome"
   - Confirm installation

2. **Firefox Users**:
   - Go to [Firefox Add-ons](https://addons.mozilla.org)
   - Search for "nos2x"
   - Click "Add to Firefox"
   - Confirm installation

#### **Step 2: Configure nos2x**

1. **Click the nos2x extension icon** in your browser toolbar
2. **Generate or Import Key**:
   - **New Users**: Click "Generate New Key"
   - **Existing Users**: Click "Import Key" and paste your private key
3. **Set Display Name** (optional but recommended)
4. **Enable Permissions** for sovren.app domain

#### **Step 3: Connect to Sovren**

1. **Visit Sovren**: Go to [sovren.app](https://sovren.app)
2. **Click "Connect Extension"** on the login page
3. **Authorize nos2x** when prompted
4. **You're ready!** Your NOSTR identity is now connected

---

### **Option 2: Alby Extension Setup**

#### **Step 1: Install Alby**

1. **Chrome/Edge Users**:
   - Go to [Chrome Web Store](https://chrome.google.com/webstore)
   - Search for "Alby"
   - Click "Add to Chrome"
   - Confirm installation

2. **Firefox Users**:
   - Go to [Firefox Add-ons](https://addons.mozilla.org)
   - Search for "Alby"
   - Click "Add to Firefox"
   - Confirm installation

#### **Step 2: Configure Alby Wallet**

1. **Click the Alby extension icon** in your browser toolbar
2. **Choose Setup Option**:
   - **New to Lightning**: Follow guided setup for new wallet
   - **Existing Wallet**: Connect your existing Lightning wallet
   - **Alby Account**: Sign up for Alby account (recommended)

3. **Setup Lightning Wallet**:
   - Follow the on-screen instructions
   - Fund your wallet with some sats (optional but recommended)

#### **Step 3: Configure NOSTR Settings**

1. **Open Alby Settings** (gear icon)
2. **Go to "NOSTR" tab**
3. **Generate or Import NOSTR Key**:
   - **New Users**: Click "Generate NOSTR Key"
   - **Existing Users**: Click "Import Key" and paste your private key
4. **Enable NOSTR Permissions** for sovren.app

#### **Step 4: Connect to Sovren**

1. **Visit Sovren**: Go to [sovren.app](https://sovren.app)
2. **Click "Connect Extension"** on the login page
3. **Select Alby** from the detected extensions
4. **Authorize Alby** when prompted
5. **You're ready!** Both Lightning and NOSTR features are available

---

## 🔐 **Security Best Practices**

### **1. Private Key Security**

- ✅ **Never share your private key** with anyone
- ✅ **Backup your private key** securely (offline storage recommended)
- ✅ **Use a strong password** for your browser profile
- ✅ **Log out of shared computers** after use

### **2. Extension Permissions**

- ✅ **Review permissions** before granting access
- ✅ **Only authorize trusted domains** like sovren.app
- ✅ **Regularly review** connected applications
- ✅ **Revoke access** for unused applications

### **3. Browser Security**

- ✅ **Keep your browser updated** to the latest version
- ✅ **Use official extension stores** only
- ✅ **Enable browser security features** (anti-phishing, etc.)
- ✅ **Use HTTPS websites** only (like https://sovren.app)

---

## 💡 **Usage Tips**

### **First-Time Connection**

1. **Allow Pop-ups**: Your browser may block extension pop-ups initially
2. **Check Extension Icon**: Look for confirmation badges or notifications
3. **Refresh Page**: If connection fails, refresh and try again
4. **Check Permissions**: Ensure Sovren has required permissions

### **Daily Usage**

1. **One-Click Login**: Extensions remember your authorization
2. **Automatic Signing**: Events are signed seamlessly in the background
3. **Lightning Payments**: Alby users can pay Lightning invoices directly
4. **Multiple Accounts**: Switch between different NOSTR identities easily

### **Troubleshooting Quick Fixes**

1. **Connection Issues**: Refresh page and retry
2. **Permission Denied**: Check extension settings and re-authorize
3. **Slow Response**: Wait 10 seconds, extensions need time to load
4. **Missing Extension**: Install and setup before connecting

---

## 🎨 **Advanced Features**

### **Multiple Extension Support**

If you have both nos2x and Alby installed:

1. **Sovren will detect both** extensions automatically
2. **Choose your preferred** extension for each session
3. **Alby users get Lightning features** in addition to NOSTR
4. **Switch between extensions** without losing data

### **Lightning Network with Alby**

- **Instant Payments**: Pay content creators with Lightning
- **Micro-transactions**: Support creators with small amounts
- **Low Fees**: Minimal fees for all Lightning transactions
- **Fast Settlement**: Payments are settled instantly

### **Content Creator Features**

- **Receive Lightning Tips**: Get paid instantly by your audience
- **NOSTR Publishing**: Share content directly to the NOSTR network
- **Encrypted Messages**: Send private messages using NIP-04/NIP-44
- **Cross-Platform Reach**: Content appears across all NOSTR clients

---

## 📱 **Mobile Support**

### **Mobile Browser Extensions**

Currently, mobile browser extensions have limited support:

- **Android Chrome**: Some extensions work with developer mode
- **iOS Safari**: Limited extension support
- **Mobile Web**: Use Sovren's fallback authentication for mobile

### **Recommended Mobile Workflow**

1. **Setup extensions on desktop** first
2. **Generate QR codes** for mobile authentication
3. **Use mobile NOSTR clients** like Damus or Amethyst
4. **Sync with desktop** for full functionality

---

## 🆘 **Getting Help**

### **Quick Support**

- **Documentation**: Check our [troubleshooting guide](troubleshooting-guide.md)
- **Community**: Join our Discord for peer support
- **Support**: Email support@sovren.app for technical issues

### **Extension-Specific Support**

- **nos2x Issues**: Visit [nos2x GitHub](https://github.com/fiatjaf/nos2x)
- **Alby Issues**: Visit [Alby Support](https://alby.com/support)
- **General NOSTR**: Check [NOSTR Documentation](https://nostr.com)

---

## 🏁 **Conclusion**

You're now ready to use NOSTR browser extensions with Sovren! This setup gives you:

- ✅ **Seamless Authentication** with your NOSTR identity
- ✅ **Lightning Network Payments** (with Alby)
- ✅ **Secure Key Management** through browser extensions
- ✅ **Cross-Platform Compatibility** across NOSTR clients

**Next Steps**:

1. **Explore Sovren Features**: Create content, tip creators, build your audience
2. **Connect with Creators**: Follow your favorite content creators
3. **Share Content**: Publish to both Sovren and the broader NOSTR network
4. **Earn Sats**: Monetize your content with Lightning Network tips

---

**Need more help?** Check our [Troubleshooting Guide](troubleshooting-guide.md) or contact support@sovren.app
