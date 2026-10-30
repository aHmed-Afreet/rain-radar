"use client";
import {useEffect,useState} from "react";
import {MapContainer,TileLayer,Marker,useMap} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
type Frame={time:number,path:string};
type RainData={host:string,radar:{past:Frame[]}};
const marker=L.divIcon({className:"radar-marker",html:'<span aria-label="Selected forecast location">📍</span>',iconSize:[28,32],iconAnchor:[14,32]});
function Recenter({lat,lon}:{lat:number,lon:number}){const map=useMap();useEffect(()=>{map.setView([lat,lon],Math.min(map.getZoom(),7))},[lat,lon,map]);return null}
export default function RadarMap({lat,lon}:{lat:number,lon:number}){
 const [data,setData]=useState<RainData|null>(null),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;async function load(){try{const r=await fetch("https://api.rainviewer.com/public/weather-maps.json");if(!r.ok)throw Error("Radar metadata unavailable");const j=await r.json() as RainData;if(active){setData(j);setIndex(Math.max(0,(j.radar?.past?.length||1)-1));setError(j.radar?.past?.length?"":"No radar frames are currently available.")}}catch{if(active)setError("Radar data is unavailable right now.")}}load();const timer=setInterval(load,600000);return()=>{active=false;clearInterval(timer)}},[]);
 const frames=data?.radar?.past||[];
 useEffect(()=>{if(!playing||frames.length<2)return;const timer=setInterval(()=>setIndex(i=>(i+1)%frames.length),850);return()=>clearInterval(timer)},[playing,frames.length]);
 const frame=frames[Math.min(index,frames.length-1)];
 const url=data&&frame?data.host+frame.path+"/256/{z}/{x}/{y}/2/1_1.png":null;
 return <div className="radar-shell"><div className="radar-canvas"><MapContainer center={[lat,lon]} zoom={6} minZoom={2} maxZoom={7} scrollWheelZoom={false} style={{height:"100%",width:"100%"}}><Recenter lat={lat} lon={lon}/><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{url&&<TileLayer key={url} url={url} opacity={0.82} maxNativeZoom={7} maxZoom={7} attribution='Radar: <a href="https://www.rainviewer.com/">RainViewer</a>'/>}<Marker position={[lat,lon]} icon={marker}/></MapContainer></div><div className="radar-toolbar"><button disabled={frames.length<2} onClick={()=>setPlaying(v=>!v)}>{playing?"Pause animation":"▶ Play radar"}</button><input aria-label="Radar history timeline" type="range" min={0} max={Math.max(0,frames.length-1)} value={Math.min(index,Math.max(0,frames.length-1))} onChange={e=>{setPlaying(false);setIndex(Number(e.target.value))}} disabled={frames.length<2}/><span>{frame?new Date(frame.time*1000).toLocaleString("en-AE",{hour:"numeric",minute:"2-digit",timeZoneName:"short"}):"Loading frames…"}</span></div>{error&&<p className="radar-error">{error}</p>}<p className="radar-disclaimer">Historical radar observations only — not a forecast or verified local rain-arrival time. Coverage and freshness vary by location. Data: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a>.</p></div>
}