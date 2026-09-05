package com.karuhundeveloper.poskacaw;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.cert.CertificateException;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureCredential")
public class SecureCredentialPlugin extends Plugin {
    private static final String PREFERENCES_NAME = "pos_pro_secure_credentials";
    private static final String CREDENTIAL_KEY = "bearer";
    private static final String KEYSTORE_ALIAS = "pos_kacaw_pos_pro_bearer_v1";
    private static final String KEYSTORE_NAME = "AndroidKeyStore";
    private static final String CIPHER_TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH_BITS = 128;

    @PluginMethod
    public void get(PluginCall call) {
        String encrypted = preferences().getString(CREDENTIAL_KEY, null);
        if (encrypted == null) {
            call.resolve(new JSObject());
            return;
        }

        try {
            JSObject result = new JSObject();
            result.put("value", decrypt(encrypted));
            call.resolve(result);
        } catch (GeneralSecurityException | IllegalArgumentException error) {
            preferences().edit().remove(CREDENTIAL_KEY).commit();
            call.reject("Secure credential is unavailable.", "secure_credential_unavailable");
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String value = call.getString("value");
        if (value == null || value.isEmpty()) {
            call.reject("Credential value is required.", "invalid_credential");
            return;
        }

        try {
            if (!preferences().edit().putString(CREDENTIAL_KEY, encrypt(value)).commit()) {
                call.reject("Secure credential could not be saved.", "secure_credential_unavailable");
                return;
            }
            call.resolve();
        } catch (GeneralSecurityException error) {
            call.reject("Secure credential could not be saved.", "secure_credential_unavailable");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        if (!preferences().edit().remove(CREDENTIAL_KEY).commit()) {
            call.reject("Secure credential could not be removed.", "secure_credential_unavailable");
            return;
        }
        call.resolve();
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    private String encrypt(String value) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
            + "."
            + Base64.encodeToString(ciphertext, Base64.NO_WRAP);
    }

    private String decrypt(String encrypted) throws GeneralSecurityException {
        int separator = encrypted.indexOf('.');
        if (separator <= 0 || separator == encrypted.length() - 1) {
            throw new GeneralSecurityException("Malformed secure credential.");
        }

        byte[] iv = Base64.decode(encrypted.substring(0, separator), Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(encrypted.substring(separator + 1), Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }

    private SecretKey getOrCreateKey() throws GeneralSecurityException {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_NAME);
        try {
            keyStore.load(null);
        } catch (IOException | CertificateException error) {
            throw new KeyStoreException("Unable to load Android Keystore.", error);
        }

        Key existing = keyStore.getKey(KEYSTORE_ALIAS, null);
        if (existing instanceof SecretKey) {
            return (SecretKey) existing;
        }
        if (existing != null) {
            throw new KeyStoreException("Unexpected Android Keystore entry.");
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_NAME);
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build();
        generator.init(spec);
        return generator.generateKey();
    }
}
