# 🔍 NIP-05 Verification System - User Guide

**Version**: 1.0.0
**Last Updated**: 2024-12-29
**Status**: Complete Implementation

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Verification Methods](#verification-methods)
4. [Step-by-Step Verification Process](#step-by-step-verification-process)
5. [Managing Your Verifications](#managing-your-verifications)
6. [Understanding Verification Status](#understanding-verification-status)
7. [Troubleshooting Common Issues](#troubleshooting-common-issues)
8. [Best Practices](#best-practices)
9. [Security Considerations](#security-considerations)
10. [FAQ](#faq)

## Introduction

NIP-05 is a NOSTR protocol standard that allows you to verify your identity by linking your NOSTR public key with a domain name or email-like identifier. This system helps others verify that you are the legitimate owner of a particular domain or identifier.

### Why Use NIP-05 Verification?

- **Identity Verification**: Prove ownership of your domain or identifier
- **Trust Building**: Establish credibility in the NOSTR ecosystem
- **Discovery**: Make it easier for others to find and verify your identity
- **Security**: Reduce risk of impersonation and identity fraud

## Getting Started

### Prerequisites

Before starting the verification process, ensure you have:

1. **NOSTR Account**: A valid NOSTR keypair (public/private key)
2. **Domain Access**: Control over a domain you want to verify with
3. **Sovren Account**: Access to the Sovren platform with authentication

### Accessing the Verification System

1. Log into your Sovren account
2. Navigate to **Settings** → **Identity** → **NIP-05 Verification**
3. Click **"Add Verification"** to start the process

## Verification Methods

The system supports three verification methods:

### 1. HTTP Verification (Recommended)

**How it works**: Places a `.well-known/nostr.json` file on your domain

**Requirements**:

- Web server access
- Ability to create files in `.well-known/` directory

**Pros**:

- Industry standard
- Automatically verified by NOSTR clients
- Most reliable method

**Cons**:

- Requires web server access

### 2. DNS TXT Record Verification

**How it works**: Creates a TXT record in your domain's DNS

**Requirements**:

- DNS management access
- Ability to create TXT records

**Pros**:

- No web server required
- Works for any domain
- Relatively simple setup

**Cons**:

- DNS propagation delays
- Less widely supported

### 3. Manual Verification

**How it works**: Admin approval after manual verification

**Requirements**:

- Documentation of domain ownership
- Admin review process

**Pros**:

- Works when other methods aren't possible
- Flexible for special cases

**Cons**:

- Slower process
- Requires manual review

## Step-by-Step Verification Process

### HTTP Verification Process

1. **Initiate Verification**:

   - Click "Add Verification"
   - Enter your desired identifier (e.g., `yourname@yourdomain.com`)
   - Select "HTTP (/.well-known/nostr.json)" as the method
   - Click "Create Verification"

2. **Set Up the Well-Known File**:

   ```json
   {
     "names": {
       "yourname": "your-nostr-public-key-in-hex"
     }
   }
   ```

   - Save this file as `nostr.json` in your domain's `.well-known/` directory
   - Ensure the file is accessible at `https://yourdomain.com/.well-known/nostr.json`

3. **Verify the Setup**:

   - Test the URL in your browser
   - Ensure it returns the JSON with your public key
   - No trailing slashes or redirects

4. **Complete Verification**:
   - Return to Sovren and click "Verify"
   - The system will check your file and update the status

### DNS TXT Record Verification

1. **Initiate Verification**:

   - Select "DNS (TXT record)" as the method
   - Enter your identifier

2. **Create TXT Record**:

   - Add a TXT record to your domain:

   ```
   Name: _nostr.yourname
   Value: your-nostr-public-key-in-hex
   ```

3. **Wait for DNS Propagation**:

   - DNS changes can take 1-48 hours to propagate
   - Use online DNS checkers to verify propagation

4. **Complete Verification**:
   - Click "Verify" in Sovren once DNS has propagated

### Manual Verification Process

1. **Submit Request**:

   - Select "Manual Verification"
   - Provide documentation of domain ownership
   - Include explanation of why other methods aren't available

2. **Admin Review**:

   - Our team will review your submission
   - May request additional documentation

3. **Approval Process**:
   - You'll receive notification of approval/rejection
   - Approved verifications are activated immediately

## Managing Your Verifications

### Verification Dashboard

The verification dashboard shows:

- **Status Overview**: Counts of verified, pending, and failed verifications
- **Verification List**: All your active and historical verifications
- **Domain Statistics**: Performance metrics for your domains

### Available Actions

- **Refresh**: Manually re-check verification status
- **Copy Identifier**: Copy your NIP-05 identifier to clipboard
- **View Details**: See verification metadata and history
- **Revoke**: Remove a verification (cannot be undone)

### Status Monitoring

Each verification shows:

- **Current Status**: Verified, Pending, Failed, Expired, or Revoked
- **Method Used**: HTTP, DNS, or Manual
- **Last Checked**: When the system last verified the setup
- **Verification Count**: Number of checks performed
- **Expiration**: When re-verification is needed (if applicable)

## Understanding Verification Status

### Status Types

| Status          | Description                      | Action Required     |
| --------------- | -------------------------------- | ------------------- |
| **Verified** ✅ | Successfully verified and active | None                |
| **Pending** ⏳  | Verification in progress         | Wait or check setup |
| **Failed** ❌   | Verification failed              | Fix setup and retry |
| **Expired** 🕐  | Verification needs renewal       | Re-verify           |
| **Revoked** ⛔  | Manually removed                 | None                |

### Verification Indicators

- **Green Badge**: Verified and trusted
- **Yellow Badge**: Pending or needs attention
- **Red Badge**: Failed or revoked
- **Shield Icon**: Trusted domain with strong reputation

## Troubleshooting Common Issues

### HTTP Verification Issues

**Problem**: File not found (404 error)

- **Solution**: Ensure file exists at exact path: `/.well-known/nostr.json`
- Check file permissions (must be publicly readable)
- Verify no redirects are interfering

**Problem**: Wrong JSON format

- **Solution**: Validate JSON syntax using online tools
- Ensure public key is in hex format (64 characters)
- Check for extra whitespace or characters

**Problem**: HTTPS certificate issues

- **Solution**: Ensure valid SSL certificate
- Check certificate chain is complete
- Verify HTTPS is working properly

### DNS Verification Issues

**Problem**: TXT record not found

- **Solution**: Verify record name: `_nostr.yourname.yourdomain.com`
- Check DNS propagation status
- Ensure record value is correct hex key

**Problem**: Multiple TXT records

- **Solution**: Remove duplicate records
- Ensure only one record exists for the name
- Contact DNS provider if issues persist

**Problem**: Propagation delays

- **Solution**: Wait 24-48 hours for global propagation
- Use DNS checking tools to monitor status
- Consider lowering TTL for faster updates

### General Issues

**Problem**: Verification keeps failing

- **Solution**:
  1. Check system status dashboard
  2. Verify your setup matches requirements exactly
  3. Try a different verification method
  4. Contact support with error details

**Problem**: Can't access verification dashboard

- **Solution**:
  1. Ensure you're logged in
  2. Check your account has necessary permissions
  3. Clear browser cache and cookies
  4. Try a different browser

## Best Practices

### Security Best Practices

1. **Keep Keys Secure**: Never share your private key
2. **Use HTTPS**: Always serve well-known files over HTTPS
3. **Regular Monitoring**: Check verification status regularly
4. **Quick Response**: Address failed verifications promptly
5. **Backup Plans**: Consider multiple verification methods

### Performance Best Practices

1. **Fast Servers**: Use reliable hosting for well-known files
2. **CDN Usage**: Consider CDN for better global availability
3. **Monitoring**: Set up monitoring for your verification endpoints
4. **Caching**: Configure appropriate cache headers
5. **Redundancy**: Have backup verification methods

### Maintenance Best Practices

1. **Regular Checks**: Monitor verification status weekly
2. **Update Records**: Keep verification information current
3. **Documentation**: Document your verification setup
4. **Testing**: Test verification endpoints regularly
5. **Backup**: Maintain backups of verification configurations

## Security Considerations

### Protecting Your Identity

- **Private Key Security**: Never expose your private key in verification files
- **Public Key Accuracy**: Double-check your public key is correct
- **Domain Control**: Maintain control over verified domains
- **Regular Audits**: Review active verifications periodically

### Common Security Risks

1. **Domain Hijacking**: Loss of domain control invalidates verification
2. **File Tampering**: Unauthorized changes to well-known files
3. **DNS Poisoning**: Malicious DNS record modifications
4. **Key Rotation**: Changing keys requires re-verification

### Mitigation Strategies

- Use strong domain registrar security
- Monitor domain expiration dates
- Set up DNS change notifications
- Regular verification audits
- Backup verification methods

## FAQ

### General Questions

**Q: How long does verification take?**
A: HTTP verification is usually instant. DNS verification can take 1-48 hours due to propagation delays. Manual verification typically takes 1-3 business days.

**Q: Can I verify multiple identifiers for the same domain?**
A: Yes, you can create multiple verifications for different local parts (the part before @) on the same domain.

**Q: What happens if my domain expires?**
A: Your verification will fail when the domain becomes inaccessible. You'll need to renew the domain or set up verification on a new domain.

**Q: Can I change my NOSTR public key?**
A: You'll need to create a new verification with your new key. The old verification will need to be revoked.

### Technical Questions

**Q: What's the exact format for the well-known file?**
A: The file must be valid JSON with a "names" object mapping local parts to hex public keys:

```json
{
  "names": {
    "localpart": "hex-public-key"
  }
}
```

**Q: Can I use a subdomain for verification?**
A: Yes, you can verify any domain or subdomain you control.

**Q: What if my server doesn't support .well-known directories?**
A: Use DNS TXT record verification instead, or contact your hosting provider about adding .well-known support.

**Q: How often does the system re-check verifications?**
A: Active verifications are checked daily. Failed verifications are rechecked every few hours.

### Support Questions

**Q: Where can I get help if I'm stuck?**
A: Contact support through the platform or check our troubleshooting guides. Include your identifier and error details.

**Q: Can I get verification priority for important domains?**
A: Contact support for enterprise verification options which may include priority processing.

**Q: What if I need to verify a domain I don't own?**
A: You must have control over the domain to verify it. Consider contacting the domain owner or using a domain you control.

---

## Getting Help

If you need assistance with NIP-05 verification:

1. **Check Troubleshooting**: Review the troubleshooting section above
2. **System Status**: Check the system status dashboard for any known issues
3. **Contact Support**: Reach out through the platform with specific error details
4. **Community**: Join our community channels for peer support

For technical implementation details, see the [Developer Documentation](../development/nip05-verification-developer-guide.md).

---

_This guide is regularly updated. Last revision: 2024-12-29_
