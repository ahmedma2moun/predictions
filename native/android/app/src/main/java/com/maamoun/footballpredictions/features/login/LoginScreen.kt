package com.maamoun.footballpredictions.features.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.core.designsystem.AppButton
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette

@Composable
fun LoginScreen(app: AppContainer) {
    val vm = appViewModel { LoginViewModel(app) }
    val c = palette
    val focus = LocalFocusManager.current

    Box(Modifier.fillMaxSize().background(c.background).imePadding(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier.widthIn(max = 560.dp).fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding()
                .padding(horizontal = Tokens.Spacing.xl).padding(top = Tokens.Spacing.xl, bottom = Tokens.Spacing.xxl),
        ) {
            Box(
                Modifier.size(56.dp).background(c.primary, RoundedCornerShape(Tokens.Radius.md))
                    .border(1.dp, c.primary, RoundedCornerShape(Tokens.Radius.md)),
                contentAlignment = Alignment.Center,
            ) { Text("⚽", fontSize = 28.sp) }
            Spacer(Modifier.height(Tokens.Spacing.xl))
            Text(
                "Predict the\nbeautiful game.", color = c.foreground,
                style = appFont(Tokens.FontSize.display, W.Bold, letterSpacing = (-1.2).sp).copy(lineHeight = 42.sp),
            )
            Spacer(Modifier.height(Tokens.Spacing.md))
            Text(
                "Score your picks against friends across the Premier League, UCL and more.",
                color = c.mutedForeground, style = appFont(14.5.sp).copy(lineHeight = 22.sp),
            )
            Spacer(Modifier.weight(1f).heightIn(min = Tokens.Spacing.xxl))

            Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
                Field("Email", vm.email, { vm.email = it }, "you@example.com", KeyboardType.Email, ImeAction.Next,
                    KeyboardActions(onNext = { focus.moveFocus(FocusDirection.Down) }))
                Field("Password", vm.password, { vm.password = it }, "••••••••", KeyboardType.Password, ImeAction.Go,
                    KeyboardActions(onGo = { focus.clearFocus(); vm.submit() }), password = true)
                AppButton("Sign In", onClick = { focus.clearFocus(); vm.submit() }, loading = vm.isLoading, fullWidth = true,
                    modifier = Modifier.height(54.dp))
            }
            Text(
                "By continuing, you agree to our Terms and Privacy Policy.", color = c.mutedForeground,
                style = appFont(11.5.sp, align = TextAlign.Center).copy(lineHeight = 18.sp),
                modifier = Modifier.fillMaxWidth().padding(top = Tokens.Spacing.xl),
            )
        }
    }
}

@Composable
private fun Field(
    label: String, value: String, onChange: (String) -> Unit, placeholder: String,
    keyboardType: KeyboardType, imeAction: ImeAction, actions: KeyboardActions, password: Boolean = false,
) {
    val c = palette
    val shape = RoundedCornerShape(Tokens.Radius.md)
    Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
        Text(label, color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Medium))
        TextField(
            value = value, onValueChange = onChange, singleLine = true,
            placeholder = { Text(placeholder, color = c.mutedForeground) },
            textStyle = appFont(Tokens.FontSize.md),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction, autoCorrectEnabled = false),
            keyboardActions = actions,
            visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            shape = shape,
            colors = TextFieldDefaults.colors(
                focusedContainerColor = c.cardElevated, unfocusedContainerColor = c.cardElevated,
                focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                focusedTextColor = c.foreground, unfocusedTextColor = c.foreground, cursorColor = c.primary,
            ),
            modifier = Modifier.fillMaxWidth().height(52.dp).border(1.dp, c.input, shape),
        )
    }
}
