from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import math

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Location(BaseModel):
    lat: float
    lng: float

class RouteRequest(BaseModel):
    locations: List[Location]

class DelayRequest(BaseModel):
    distance_km: float
    weather_condition: str = "clear"
    traffic_level: str = "low" # low, medium, high

class MaintenanceRequest(BaseModel):
    mileage: int
    last_service_date: str # YYYY-MM-DD
    vehicle_year: int

# --- LOGIC ---

def calculate_distance(loc1, loc2):
    # Haversine formula approximation or simple Euclidean for small scale
    # Using simple Euclidean for speed/demo (assuming small area)
    return math.sqrt((loc1.lat - loc2.lat)**2 + (loc1.lng - loc2.lng)**2)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "HackNova AI"}

@app.post("/predict-delay")
def predict_delay(data: DelayRequest):
    # Heuristic Logic
    base_time_per_km = 2 # minutes
    delay_factor = 1.0
    
    if data.traffic_level == "medium":
        delay_factor += 0.3
    elif data.traffic_level == "high":
        delay_factor += 0.8
        
    if data.weather_condition == "rain":
        delay_factor += 0.2
    elif data.weather_condition == "snow":
        delay_factor += 0.5
        
    estimated_time = data.distance_km * base_time_per_km * delay_factor
    risk_level = "LOW"
    
    if delay_factor > 1.5:
        risk_level = "HIGH"
    elif delay_factor > 1.2:
        risk_level = "MEDIUM"
        
    return {
        "estimated_duration_min": round(estimated_time, 2),
        "risk_level": risk_level,
        "delay_factor": round(delay_factor, 2)
    }

@app.post("/optimize-route")
def optimize_route(data: RouteRequest):
    # Simple Nearest Neighbor for TSP
    if not data.locations:
        return {"optimized_indices": []}
        
    unvisited = list(range(len(data.locations)))
    current_idx = unvisited.pop(0) # Start specific point or first
    path = [current_idx]
    
    while unvisited:
        curr_loc = data.locations[current_idx]
        # Find nearest
        nearest_idx = -1
        min_dist = float('inf')
        
        for idx in unvisited:
            cand_loc = data.locations[idx]
            dist = calculate_distance(curr_loc, cand_loc)
            if dist < min_dist:
                min_dist = dist
                nearest_idx = idx
        
        current_idx = nearest_idx
        unvisited.remove(current_idx)
        path.append(current_idx)
        
    return {"optimized_indices": path}

@app.post("/maintenance-alert")
def maintenance_alert(data: MaintenanceRequest):
    score = 0
    alerts = []
    
    if data.mileage > 10000:
        score += 50
        alerts.append("High Mileage")
    
    if data.vehicle_year < 2015:
        score += 30
        alerts.append("Aging Vehicle")
        
    status = "Good"
    if score > 70:
        status = "Critical"
    elif score > 30:
        status = "Warning"
        
    return {
        "maintenance_score": score,
        "status": status,
        "alerts": alerts
    }

# --- SMART ROUTE MODULE ---
import requests

GEOAPIFY_KEY = "3ba2f7a896fe4da58e2061925b149c00"
TOMTOM_KEY = "dOqZRwaVoIGDgP5GIDCcGaz4u8NW2s0u"
NEWS_KEY = "2841aaffd0794bf9ace7e9a239c03bef"

from typing import List, Optional
import traceback

class RouteAnalysisRequest(BaseModel):
    origin_lat: float = 19.0760
    origin_lng: float = 72.8777
    dest_lat: float = 18.5204
    dest_lng: float = 73.8567
    origin_city: str = "Mumbai"
    dest_city: str = "Pune"
    # Enhanced Fields with Defaults
    freight_type: str = "Standard"
    weight: float = 100.0
    deadline: Optional[str] = None

@app.post("/analyze-route")
def analyze_route(data: RouteAnalysisRequest):
    try:
        print(f"DEBUG: Received Request: {data}")
        alerts = []
        base_score = 100
        penalties = {"Weather": 0, "Traffic": 0, "News": 0, "Freight": 0}
        
        # 1. Geoapify Routing & Geometry
        route_summary = {}
        route_geometry = [] # List of [lat, lng]
        
        try:
            # Request geometry=geojson
            url = f"https://api.geoapify.com/v1/routing?waypoints={data.origin_lat},{data.origin_lng}|{data.dest_lat},{data.dest_lng}&mode=truck&details=instruction_details&format=geojson&apiKey={GEOAPIFY_KEY}"
            resp = requests.get(url).json()

            if "features" in resp and resp["features"]:
                feature = resp["features"][0]
                props = feature["properties"]
                geometry = feature["geometry"]["coordinates"] # [[ln, lt], ...]
                
                # Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
                for segment in geometry:
                     # It's usually a LineString (list of points) or MultiLineString
                     if isinstance(segment[0], float): # Point
                         route_geometry.append([segment[1], segment[0]])
                     else: # Nested list (MultiLineString part)
                         for pt in segment:
                             route_geometry.append([pt[1], pt[0]])

                route_summary = {
                    "distance_km": round(props.get("distance", 0) / 1000, 2),
                    "time_min": round(props.get("time", 0) / 60, 0)
                }
            else:
                route_summary = {"error": "Routing failed"}
        except Exception as e:
            print(f"Geoapify Error: {e}")
            route_summary = {"error": "API Error"}

        # 2. Open-Meteo Weather (Enriched)
        weather_info = "Clear"
        weather_impact = "No significant delay expected."
        
        # Freight & Weight Impact on Weather Sensitivity
        weather_sensitivity = 1.0
        if data.freight_type == "Perishable" or data.freight_type == "Hazardous":
            weather_sensitivity = 1.5
        if data.weight > 10000: # 10 Tons
            weather_sensitivity = 1.3

        try:
            w_url = f"https://api.open-meteo.com/v1/forecast?latitude={data.dest_lat}&longitude={data.dest_lng}&current_weather=true"
            w_resp = requests.get(w_url).json()
            if "current_weather" in w_resp:
                code = w_resp["current_weather"]["weathercode"]
                temp = w_resp["current_weather"]["temperature"]
                
                weather_desc = "Clear"
                if code >= 95: 
                    weather_desc = "Thunderstorm"
                    penalties["Weather"] = 30 * weather_sensitivity
                    alerts.append(f"Severe Thunderstorm with {data.freight_type} cargo is High Risk.")
                    weather_impact = "Extreme caution required. Delay recommended."
                elif code >= 71: 
                    weather_desc = "Snow"
                    penalties["Weather"] = 20 * weather_sensitivity
                    alerts.append("Snowfall detected: Traction compromised.")
                    weather_impact = f"Heavy load ({data.weight}kg) stopping distance significantly increased." if data.weight > 5000 else "Roads slippery. Expect delays."
                elif code >= 51: 
                    weather_desc = "Rain"
                    penalties["Weather"] = 10 * weather_sensitivity
                    alerts.append("Rainy conditions.")
                    weather_impact = "Wet roads detected."
                else:
                    weather_impact = "Good visibility and dry roads."
                    
                weather_info = f"{weather_desc} ({temp}°C)"
        except:
            weather_info = "Unknown"

        # 3. Freight Specific Penalties
        if data.freight_type == "Hazardous" and penalties["Weather"] > 0:
            penalties["Freight"] += 15
            alerts.append("Hazardous Cargo + Bad Weather = Increased Policy Risk.")
        
        if data.freight_type == "Perishable" and route_summary.get("time_min", 0) > 600: # >10 Hours
            penalties["Freight"] += 10
            alerts.append("Long haul risk for Perishable goods.")

        # 4. NewsAPI (Transport Focused & Filtered - Only relevant traffic/accident/protest articles)
        news_content = None
        relevant_articles = []
        try:
            # Search for traffic, accidents, protests, road closures, disruptions
            keywords = ["traffic jam", "traffic congestion", "accident", "road accident", "crash", 
                       "protest", "demonstration", "roadblock", "road closure", "route blocked",
                       "vehicle breakdown", "traffic disruption", "highway blocked", "traffic delay"]
            
            q = f"({' OR '.join(keywords)}) AND ({data.origin_city} OR {data.dest_city} OR route)"
            n_url = f"https://newsapi.org/v2/everything?q={q}&apiKey={NEWS_KEY}&sortBy=relevance&pageSize=10&language=en"
            n_resp = requests.get(n_url).json()

            # Filter articles to only include those directly affecting the journey
            for article in n_resp.get("articles", []):
                title = (article.get("title") or "").lower()
                desc = (article.get("description") or "").lower()
                content = (article.get("content") or "").lower()
                full_text = f"{title} {desc} {content}"
                
                # Check if article is relevant (contains traffic/accident/protest keywords AND city names)
                is_relevant = False
                for keyword in keywords:
                    if keyword in full_text:
                        # Check if it mentions origin or destination city
                        if data.origin_city.lower() in full_text or data.dest_city.lower() in full_text or "route" in full_text or "highway" in full_text:
                            is_relevant = True
                            break
                
                # Additional check: exclude non-relevant articles (business, politics unrelated to transport)
                exclude_keywords = ["business", "stock", "market", "politics", "election", "sports", "entertainment"]
                if any(exclude in full_text for exclude in exclude_keywords):
                    if not any(transport_keyword in full_text for transport_keyword in ["traffic", "transport", "road", "vehicle", "accident"]):
                        is_relevant = False
                
                if is_relevant and len(full_text) > 100:
                    relevant_articles.append({
                        "title": article.get("title", ""),
                        "description": article.get("description", ""),
                        "url": article.get("url", "")
                    })
                    alerts.append(f"Route Alert: {article.get('title', '')}")
                    penalties["News"] = 15
                    if len(relevant_articles) >= 3:  # Limit to 3 most relevant
                        break
                        
            if relevant_articles:
                news_content = relevant_articles[0].get("description", "")[:200] + "..."
        except Exception as e:
            print(f"News API Error: {e}")
            pass

        # 5. Advanced Scoring Logic (Continuous & Sensitive)
        
        # A. Weight Penalty (Linear scaling)
        # Every 1000kg adds 2 points of risk, up to max 20
        weight_penalty = min(20, (data.weight / 1000.0) * 2.0)
        penalties["Freight"] += int(weight_penalty)
        
        if data.weight > 5000:
             alerts.append(f"Heavy Load ({int(data.weight)}kg) increases stopping distance & fuel burn.")

        # B. Deadline & Urgency
        dist = route_summary.get("distance_km", 0)
        time_min = route_summary.get("time_min", 0)
        
        if data.deadline:
            import datetime
            try:
                deadline_dt = datetime.datetime.fromisoformat(data.deadline.replace('Z', '+00:00'))
                # Handle naive vs aware
                if deadline_dt.tzinfo is None:
                     deadline_dt = deadline_dt.replace(tzinfo=datetime.timezone.utc)
                     
                now_dt = datetime.datetime.now(datetime.timezone.utc)
                hours_remaining = (deadline_dt - now_dt).total_seconds() / 3600
                trip_hours = time_min / 60
                
                if hours_remaining <= 0:
                     penalties["Traffic"] += 40
                     alerts.append("CRITICAL: Shipment is already past deadline.")
                elif trip_hours > hours_remaining:
                     # Impossible without speeding/air
                     penalties["Traffic"] += 30 
                     alerts.append(f"Impermissible Schedule: Needs {trip_hours:.1f}h, have {hours_remaining:.1f}h.")
                elif trip_hours > (hours_remaining * 0.8):
                     # Tight Buffer (<20% slack)
                     urgency_score = (trip_hours / hours_remaining) * 15 # Scale up to 15 points
                     penalties["Traffic"] += int(urgency_score)
                     alerts.append("High Urgency: Driver fatigue risk increased.")
            except Exception as e:
                print(f"Date Parse Error: {e}")

        # C. Freight Type Intrinsic Risk
        if data.freight_type == "Hazardous":
            penalties["Freight"] += 10
        elif data.freight_type == "Fragile":
            penalties["Freight"] += 5

        # D. Recommendation Engine
        recommendation = {
            "mode": "Road",
            "reason": f"Standard trucking is efficient for {dist}km."
        }
        
        # Air Freight Trigger
        if penalties["Traffic"] > 25: # High urgency or past deadline
             recommendation = {
                "mode": "Air Freight",
                "reason": "Urgency requires Air Freight to meet customer deadline."
             }
        
        # Rail Trigger
        if dist > 800 and data.weight > 2000 and recommendation["mode"] == "Road":
             recommendation = {
                 "mode": "Rail",
                 "reason": "Bulk weight over long distance is 40% cheaper via Rail."
             }

        # Severe Weather Override
        if penalties["Weather"] > 25:
             recommendation = {
                "mode": "Wait / Rail",
                "reason": "Weather conditions unsafe for road transport."
            }

        # Final Score
        total_penalty = sum(penalties.values())
        risk_score = max(0, int(base_score - total_penalty))
        
        level = "SAFE"
        if risk_score < 50: level = "HIGH RISK"
        elif risk_score < 75: level = "CAUTION" # Stricter threshold
        elif risk_score < 90: level = "MODERATE" # New detailed level logic not used in UI but good for score
        
        # Inject News Content into Alerts if specific format requested
        if news_content:
            pass 

        return {
            "route": route_summary,
            "geometry": route_geometry,
            "eta": {
                "time_minutes": route_summary.get("time_min", 0),
                "time_hours": round(route_summary.get("time_min", 0) / 60, 1),
                "distance_km": route_summary.get("distance_km", 0),
                "distance_miles": round(route_summary.get("distance_km", 0) * 0.621371, 1),
                "formatted_eta": f"{int(route_summary.get('time_min', 0) // 60)}h {int(route_summary.get('time_min', 0) % 60)}m" if route_summary.get("time_min", 0) >= 60 else f"{int(route_summary.get('time_min', 0))} minutes"
            },
            "weather": { "desc": weather_info, "impact": weather_impact },
            "risk_score": risk_score,
            "score_breakdown": { "Base": base_score, **penalties },
            "risk_level": level,
            "recommendation": recommendation,
            "news_articles": relevant_articles if relevant_articles else [],
            "alerts": alerts
        }
    except Exception as e:
        print("CRITICAL ERROR IN ANALYZE_ROUTE:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
