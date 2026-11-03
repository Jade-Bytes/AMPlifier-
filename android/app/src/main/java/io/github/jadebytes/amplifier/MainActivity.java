package io.github.jadebytes.amplifier;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

/**
 * Hands Google's consent screen result back to the sign-in plugin. Needed for the Google Drive scope
 * (connecting Drive for note attachments); plain sign-in works without it.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN || requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) return;
        PluginHandle handle = getBridge().getPlugin("SocialLogin");
        if (handle != null && handle.getInstance() instanceof SocialLoginPlugin plugin) {
            plugin.handleGoogleLoginIntent(requestCode, data);
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
