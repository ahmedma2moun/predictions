package com.maamoun.footballpredictions.features.matchdetail

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.OddsBonus
import com.maamoun.footballpredictions.core.networking.dto.ScoringRuleBreakdown
import kotlin.math.roundToInt

/**
 * Icon-only trigger — tap opens a dialog listing only the matched rules. The odds ×N row is inserted
 * right after `correct_winner` when the bonus actually changed the score.
 */
@Composable
fun ScoringBreakdown(rules: List<ScoringRuleBreakdown>, bonus: OddsBonus? = null) {
    val c = palette
    var open by remember { mutableStateOf(false) }
    val matched = rules.filter { it.awarded }
    if (matched.isEmpty()) return
    val bonusApplied = bonus != null && bonus.finalScore != bonus.baseScore

    Box(
        Modifier.size(24.dp).clickable(role = Role.Button) { open = true }.semantics { contentDescription = "View scoring breakdown" },
        contentAlignment = Alignment.Center,
    ) { Icon(AppIcon.info, null, tint = c.mutedForeground, modifier = Modifier.size(14.dp)) }

    if (open) {
        AlertDialog(
            onDismissRequest = { open = false },
            containerColor = c.card,
            title = { Text("Rules matched", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    matched.forEach { rule ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(rule.name, color = c.success, style = appFont(Tokens.FontSize.xs, W.Medium), modifier = Modifier.weight(1f))
                            Text("+${rule.points}", color = c.success, style = appFont(Tokens.FontSize.xs, W.Semibold))
                        }
                        if (bonusApplied && rule.key == "correct_winner" && bonus != null) {
                            Row(Modifier.fillMaxWidth().padding(start = Tokens.Spacing.sm), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Odds ×${"%.2f".format(bonus.outcomeOdds)}", color = c.warning, style = appFont(Tokens.FontSize.xs, W.Medium), modifier = Modifier.weight(1f))
                                Text("→ ${(rule.points * bonus.outcomeOdds).roundToInt()}", color = c.warning, style = appFont(Tokens.FontSize.xs, W.Semibold))
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { open = false }) { Text("OK", color = c.primary) } },
        )
    }
}
