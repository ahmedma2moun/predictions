package com.maamoun.footballpredictions.app

import android.app.Application
import com.maamoun.footballpredictions.core.push.ensureNotificationChannel

class FootballPredictionsApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        AppForeground.install(this)
        ensureNotificationChannel(this)
    }
}
