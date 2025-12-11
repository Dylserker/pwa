import React, { useEffect, useState } from 'react'
import './App.css'

const CONFIG = {
  GEOCODING_API: 'https://geocoding-api.open-meteo.com/v1/search',
  WEATHER_API: 'https://api.open-meteo.com/v1/forecast',
  RAIN_CODES: [51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99],
  TEMP_THRESHOLD: 10
}

function getWeatherEmoji(code: number) {
  const map: Record<number,string> = {
    0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',56:'🌨️',57:'🌨️',61:'🌧️',63:'🌧️',65:'🌧️',66:'🌨️',67:'🌨️',71:'🌨️',73:'🌨️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️'
  }
  return map[code] || '🌤️'
}

function findCurrentHourlyIndex(hourly: any, currentTime?: string) {
  if (!hourly?.time) return -1
  if (currentTime) {
    const exact = hourly.time.indexOf(currentTime)
    if (exact !== -1) return exact
  }
  const nowTs = Date.now()
  for (let i = 0; i < hourly.time.length; i++) {
    const ts = new Date(hourly.time[i]).getTime()
    if (ts >= nowTs) return i
  }
  return hourly.time.length - 1
}

function sendNotification(title: string, body: string) {
  if (!('Notification' in globalThis)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/src/assets/icon-192.png' })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') new Notification(title, { body, icon: '/src/assets/icon-192.png' })
    })
  }
}

function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cityName, setCityName] = useState<string | null>(null)
  const [current, setCurrent] = useState<any>(null)
  const [hourly, setHourly] = useState<any>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const swUrl = `${import.meta.env.BASE_URL}service-worker.js`
    navigator.serviceWorker.register(swUrl).then((reg) => {
      console.log('SW registered at', swUrl)

      // handle updates: when a new SW is installing, ask it to skipWaiting
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // there's a waiting worker — ask it to skipWaiting and wait for confirmation
            const channel = new MessageChannel()
            channel.port1.onmessage = (event) => {
              if (event?.data && event.data.ok) {
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  window.location.reload()
                }, { once: true })
              }
            }

            try {
              newWorker.postMessage({ type: 'SKIP_WAITING' }, [channel.port2])
            } catch (e) {
              // fallback if posting the port is not supported
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          }
        })
      })
    }).catch(console.error)
  }, [])

  

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim()) { setError('Entrez une ville'); return }
    setError(null)
    setLoading(true)
    try {
      const geoRes = await fetch(`${CONFIG.GEOCODING_API}?name=${encodeURIComponent(query)}&count=1&language=fr`)
      if (!geoRes.ok) throw new Error('Erreur géocodage')
      const geo = await geoRes.json()
      if (!geo.results || geo.results.length===0) throw new Error('Ville non trouvée')
      const loc = geo.results[0]
      const fullName = `${loc.name}${loc.admin1?(', '+loc.admin1):''}, ${loc.country}`
      const lat = loc.latitude; const lon = loc.longitude

      const weatherRes = await fetch(
        `${CONFIG.WEATHER_API}?latitude=${lat}&longitude=${lon}`+
        `&current_weather=true&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=1`
      )
      if (!weatherRes.ok) throw new Error('Erreur météo')
      const weather = await weatherRes.json()
      setCityName(fullName)
      setCurrent(weather.current_weather ?? weather.current)
      setHourly(weather.hourly)
      // Checks for alerts (basic)
      checkAlerts(weather, fullName)
    } catch (err: any) {
      setError(err.message || 'Erreur')
    } finally { setLoading(false) }
  }

  

  function checkAlerts(data: any, fullName: string) {
    const baseIndex = findCurrentHourlyIndex(data?.hourly, data?.current_weather?.time ?? data?.current?.time)
    if (baseIndex < 0) return
    for (let i = 1; i <= 4; i++) {
      const idx = baseIndex + i
      if (idx >= (data?.hourly?.time?.length ?? 0)) break
      const code = data?.hourly?.weather_code?.[idx]
      const temp = data?.hourly?.temperature_2m?.[idx]
      if (code && CONFIG.RAIN_CODES.includes(code)) {
        sendNotification(fullName, `🌧️ Pluie dans ${i} heure${i>1?'s':''}`)
        return
      }
      if (temp && temp > CONFIG.TEMP_THRESHOLD) {
        sendNotification(fullName, `🌡️ Temp > ${CONFIG.TEMP_THRESHOLD}°C : ${Math.round(temp)}°C`)
        return
      }
    }
  }

  // use global sendNotification defined above

  return (
    <div className="app">
      <header>
        <h1>Météo PWA</h1>
      </header>
      <main>
        <form onSubmit={handleSearch} className="search">
          <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Ville, ex: Paris" />
          <button type="submit" disabled={loading}>Rechercher</button>
        </form>

        {loading && <p>Chargement…</p>}
        {error && <p className="error">{error}</p>}

        {cityName && current && (
          <section className="weather">
            <h2>{cityName}</h2>
            <div className="current">
              <div className="icon">{getWeatherEmoji(current.weathercode ?? current.weather_code ?? 0)}</div>
              <div className="temp">{Math.round(current.temperature ?? current.temperature_2m)}°C</div>
              <div>Vent: {Math.round((current.windspeed ?? current.wind_speed_10m ?? 0))} km/h</div>
            </div>

            {hourly && (
              <div className="hourly">
                {(() => {
                          const items: React.ReactElement[] = []
                  const baseIndex = findCurrentHourlyIndex(hourly, current?.time)
                  for (let i = 0; i < 8; i++) {
                    const idx = baseIndex + i
                    if (idx >= (hourly.time?.length ?? 0)) break
                    const t = hourly.time[idx]
                    const temp = hourly.temperature_2m?.[idx]
                    const code = hourly.weather_code?.[idx]
                    const date = new Date(t)
                    items.push(
                      <div key={t} className="hour">
                        <div>{date.getHours()}h</div>
                                <div>{getWeatherEmoji(code)}</div>
                        <div>{Math.round(temp)}°C</div>
                      </div>
                    )
                  }
                  return items
                })()}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
