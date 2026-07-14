import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Tooltip, Popup, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Map as MapIcon, Search, Car, Footprints, Bike, Navigation, Filter, Upload, Locate, Menu, X, BarChart2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { motion } from 'motion/react';

interface Street {
  id: number;
  name: string;
  type: string;
  width?: string;
  length: number;
  surface?: string;
  maxspeed?: string;
  lanes?: string;
  oneway?: string;
  positions: [number, number][];
}

// Haversine formula to calculate distance between two points in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in meters
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculatePathLength = (positions: [number, number][]) => {
  let length = 0;
  for (let i = 0; i < positions.length - 1; i++) {
    length += calculateDistance(
      positions[i][0], positions[i][1],
      positions[i+1][0], positions[i+1][1]
    );
  }
  return length;
};

const getStreetIcon = (type: string) => {
  const t = type?.toLowerCase() || '';
  if (['pedestrian', 'footway', 'steps', 'path'].includes(t)) {
    return <Footprints className="w-4 h-4 text-emerald-600" />;
  }
  if (['cycleway'].includes(t)) {
    return <Bike className="w-4 h-4 text-orange-600" />;
  }
  if (['residential', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway', 'unclassified', 'service'].includes(t)) {
    return <Car className="w-4 h-4 text-blue-600" />;
  }
  return <Navigation className="w-4 h-4 text-gray-500" />;
};

// Map event handler to synchronize zoom based on mode
function MapHandler({ mode }: { mode: string }) {
  const map = useMap();
  useEffect(() => {
    if (mode === 'cycling' || mode === 'walking') {
      map.setZoom(17, { animate: true });
    } else {
      map.setZoom(15, { animate: true });
    }
  }, [mode, map]);
  return null;
}

// Map control button to geolocate user and center map
function GeolocateControl() {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización.');
      return;
    }

    setLocating(true);
    toast.info('Buscando tu ubicación actual...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 16, { animate: true });
        toast.success('Ubicación encontrada y mapa centrado.');
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Permiso denegado para acceder a la ubicación.');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('La información de ubicación no está disponible (asegúrate de tener el GPS encendido).');
            break;
          case error.TIMEOUT:
            toast.error('Se agotó el tiempo de espera para obtener la ubicación.');
            break;
          default:
            toast.error('Ocurrió un error al obtener la ubicación.');
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="absolute bottom-6 right-6 z-[1000]">
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleLocate();
        }}
        className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-gray-700 hover:text-blue-600 hover:bg-gray-50 border border-gray-200 shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-75 disabled:pointer-events-none cursor-pointer"
        title="Centrar en mi ubicación"
        disabled={locating}
      >
        {locating ? (
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        ) : (
          <Locate className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}

function StatsPanel({ streets, onClose }: { streets: Street[], onClose: () => void }) {
  const data = useMemo(() => {
    const lengthByType: Record<string, number> = {};
    streets.forEach(s => {
      const type = s.type || 'unknown';
      if (!lengthByType[type]) lengthByType[type] = 0;
      lengthByType[type] += s.length;
    });

    return Object.entries(lengthByType)
      .map(([type, length]) => ({
        type: type.replace(/_/g, ' '),
        lengthKm: Number((length / 1000).toFixed(2))
      }))
      .sort((a, b) => b.lengthKm - a.lengthKm)
      .filter(item => item.lengthKm > 0);
  }, [streets]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9'];

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-blue-600" />
              Estadísticas de Infraestructura
            </h2>
            <p className="text-sm text-gray-500 mt-1">Longitud total de calles por tipo (en kilómetros)</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 md:p-6 flex-1 min-h-[400px] overflow-y-auto">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" unit=" km" stroke="#6b7280" fontSize={12} />
              <YAxis 
                type="category" 
                dataKey="type" 
                width={100} 
                stroke="#6b7280" 
                fontSize={12}
                tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                style={{ textTransform: 'capitalize' }}
              />
              <RechartsTooltip 
                formatter={(value: number) => [`${value} km`, 'Longitud Total']}
                labelStyle={{ textTransform: 'capitalize', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
              />
              <Bar dataKey="lengthKm" radius={[0, 4, 4, 0]} animationDuration={1500}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const StreetPolyline = React.memo(({ street, isHovered, onHover, onUnhover }: { street: Street, isHovered: boolean, onHover: (id: number) => void, onUnhover: () => void }) => {
  return (
    <Polyline 
      positions={street.positions}
      pathOptions={{ 
        color: isHovered ? '#ef4444' : '#3b82f6', 
        weight: isHovered ? 8 : 5, 
        opacity: isHovered ? 1 : 0.7, 
        className: isHovered ? 'street-line street-hover-glow' : 'street-line' 
      }}
      eventHandlers={{
        mouseover: (e) => {
          onHover(street.id);
          const layer = e.target;
          if (layer.getElement()) {
            layer.getElement().classList.add('street-hover-glow');
          }
          layer.bringToFront();
        },
        mouseout: (e) => {
          onUnhover();
          const layer = e.target;
          if (layer.getElement()) {
            layer.getElement().classList.remove('street-hover-glow');
          }
        }
      }}
    >
      <Tooltip sticky className="custom-tooltip">
        <div className="flex items-center gap-2">
          {getStreetIcon(street.type)}
          <div className="font-bold text-sm text-gray-900">{street.name || 'Calle sin nombre'}</div>
        </div>
        <div className="text-xs text-blue-600 mt-1">Clic para más detalles</div>
      </Tooltip>
      <Popup className="street-popup">
        <div className="min-w-[200px]">
          <div className="font-bold text-lg text-gray-900 border-b border-gray-200 pb-2 mb-2">
            {street.name || 'Calle sin nombre'}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-sm flex justify-between">
              <span className="font-semibold text-gray-700">Tipo:</span> 
              <span className="capitalize text-gray-600">{(street.type || '').replace('_', ' ')}</span>
            </div>
            <div className="text-sm flex justify-between">
              <span className="font-semibold text-gray-700">Longitud:</span> 
              <span className="text-gray-600">
                {street.length > 1000 ? (street.length / 1000).toFixed(2) + ' km' : Math.round(street.length) + ' m'}
              </span>
            </div>
            {street.width && (
              <div className="text-sm flex justify-between">
                <span className="font-semibold text-gray-700">Ancho prom.:</span> 
                <span className="text-gray-600">
                  {street.width}{!String(street.width).includes('m') ? ' m' : ''}
                </span>
              </div>
            )}
            {street.surface && (
              <div className="text-sm flex justify-between">
                <span className="font-semibold text-gray-700">Superficie:</span> 
                <span className="capitalize text-gray-600">{street.surface.replace('_', ' ')}</span>
              </div>
            )}
            {street.maxspeed && (
              <div className="text-sm flex justify-between">
                <span className="font-semibold text-gray-700">Velocidad Máx:</span> 
                <span className="text-gray-600">{street.maxspeed} km/h</span>
              </div>
            )}
            {street.lanes && (
              <div className="text-sm flex justify-between">
                <span className="font-semibold text-gray-700">Carriles:</span> 
                <span className="text-gray-600">{street.lanes}</span>
              </div>
            )}
            {street.oneway === 'yes' && (
              <div className="text-sm flex justify-between">
                <span className="font-semibold text-gray-700">Sentido:</span> 
                <span className="text-gray-600">Único</span>
              </div>
            )}
          </div>
        </div>
      </Popup>
    </Polyline>
  );
});

export default function App() {
  const [streets, setStreets] = useState<Street[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'general' | 'cycling' | 'walking'>('general');
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [geoJsonKey, setGeoJsonKey] = useState<number>(0);
  const [hoveredStreetId, setHoveredStreetId] = useState<number | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleHover = React.useCallback((id: number) => setHoveredStreetId(id), []);
  const handleUnhover = React.useCallback(() => setHoveredStreetId(null), []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        
        if (parsedData && (parsedData.type === 'FeatureCollection' || parsedData.type === 'Feature')) {
          setGeoJsonData(parsedData);
          setGeoJsonKey(prev => prev + 1); // Force re-render of GeoJSON component
          toast.success('Archivo GeoJSON cargado correctamente.');
        } else {
          toast.error('El archivo no parece ser un GeoJSON válido.');
        }
      } catch (error) {
        toast.error('Error al leer el archivo. Asegúrate de que sea un JSON válido.');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  useEffect(() => {
    const fetchStreets = async () => {
      try {
        setLoading(true);
        setProgress(5);
        
        const progressInterval = setInterval(() => {
          setProgress(p => (p < 85 ? p + (85 - p) * 0.1 : p));
        }, 300);

        // Bounding box for Puerto Padre, Las Tunas, Cuba
        const bbox = '21.180,-76.625,21.215,-76.575';
        const query = `[out:json][timeout:60];(way["highway"]["name"](${bbox});way["highway"~"cycleway|footway|pedestrian|path|steps"](${bbox}););out geom;`;
        
        const endpoints = [
          'https://overpass-api.de/api/interpreter',
          'https://lz4.overpass-api.de/api/interpreter',
          'https://z.overpass-api.de/api/interpreter',
          'https://overpass.kumi.systems/api/interpreter'
        ];

        let data = null;
        let lastError = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          for (const endpoint of endpoints) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout per request
              
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                data = await response.json();
                break; // Success, exit the loop
              } else {
                lastError = new Error(`HTTP Error: ${response.status}`);
              }
            } catch (e) {
              lastError = e;
              console.warn(`Failed to fetch from ${endpoint}:`, e);
            }
          }
          if (data) break;
          // Wait 1 second before retrying all endpoints
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!data) {
          throw lastError || new Error('Error en la respuesta de la API');
        }
        
        clearInterval(progressInterval);
        setProgress(90);

        const parsedStreets: Street[] = data.elements
          .filter((element: any) => element.type === 'way' && element.geometry)
          .map((element: any) => {
            const positions = element.geometry.map((node: any) => [node.lat, node.lon] as [number, number]);
            return {
              id: element.id,
              name: element.tags.name,
              type: element.tags.highway,
              width: element.tags.width,
              surface: element.tags.surface,
              maxspeed: element.tags.maxspeed,
              lanes: element.tags.lanes,
              oneway: element.tags.oneway,
              length: calculatePathLength(positions),
              positions,
            };
          });
        
        setStreets(parsedStreets);
        setProgress(100);
        toast.success(`Se han cargado ${parsedStreets.length} calles correctamente.`);
      } catch (error) {
        console.error('Error fetching streets:', error);
        toast.error('No se pudieron cargar los datos de las calles. Por favor, intente más tarde.');
      } finally {
        setTimeout(() => setLoading(false), 500);
      }
    };

    fetchStreets();
  }, []);

  const uniqueTypes = Array.from(new Set(streets.map(s => s.type))).sort();

  const filteredStreets = streets.filter(street => {
    const matchesSearch = (street.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || street.type === selectedType;
    
    let matchesMode = true;
    if (displayMode === 'cycling') {
      matchesMode = street.type === 'cycleway';
    } else if (displayMode === 'walking') {
      matchesMode = ['footway', 'pedestrian', 'path', 'steps'].includes(street.type || '');
    }
    
    return matchesSearch && matchesType && matchesMode;
  });

  return (
    <div className="w-full h-screen relative flex flex-col font-sans overflow-hidden">
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-900 z-[2000] overflow-hidden">
          <motion.div 
            className="h-full bg-blue-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear", duration: 0.3 }}
          />
        </div>
      )}
      <Toaster position="bottom-right" richColors />
      <header className="bg-blue-900 text-white p-3 md:p-4 shadow-md z-[1001] flex flex-col md:flex-row items-center gap-3">
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <MapIcon className="w-6 h-6 shrink-0" />
            <h1 className="text-xl font-bold hidden lg:block">Calles de Puerto Padre, Las Tunas</h1>
            <h1 className="text-lg font-bold md:block lg:hidden">Puerto Padre</h1>
          </div>
          <div className="text-sm opacity-80 whitespace-nowrap shrink-0 md:hidden">
            {filteredStreets.length} {filteredStreets.length === 1 ? 'calle' : 'calles'}
          </div>
        </div>
        
        <div className="w-full md:w-auto md:ml-auto relative flex flex-wrap md:flex-nowrap items-center flex-1 max-w-xl gap-2">
          <div className="flex bg-white/10 rounded-full border border-white/20 p-1 shrink-0 h-[44px]">
            <button
              onClick={() => setDisplayMode('general')}
              className={`w-9 h-full flex items-center justify-center rounded-full transition-all ${displayMode === 'general' ? 'bg-white text-blue-900 shadow-xl' : 'text-white hover:bg-white/10'}`}
              title="Modo General (Coches)"
            >
              <Car className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDisplayMode('cycling')}
              className={`w-9 h-full flex items-center justify-center rounded-full transition-all ${displayMode === 'cycling' ? 'bg-white text-blue-900 shadow-xl' : 'text-white hover:bg-white/10'}`}
              title="Modo Ciclismo"
            >
              <Bike className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDisplayMode('walking')}
              className={`w-9 h-full flex items-center justify-center rounded-full transition-all ${displayMode === 'walking' ? 'bg-white text-blue-900 shadow-xl' : 'text-white hover:bg-white/10'}`}
              title="Modo Peatonal"
            >
              <Footprints className="w-4 h-4" />
            </button>
          </div>

          <div className="relative flex-1 min-w-[150px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Buscar calle por nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 h-[44px] rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all text-sm"
            />
          </div>

          <div className="relative shrink-0">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="appearance-none pl-9 pr-8 h-[44px] rounded-full bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all text-sm cursor-pointer"
            >
              <option value="all" className="text-black">Todos los tipos</option>
              {uniqueTypes.map((type: any) => (
                <option key={type} value={type} className="text-black capitalize">
                  {String(type).replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white/60">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>

          <div className="relative shrink-0 flex gap-2">
            <button 
              onClick={() => setShowStatsPanel(true)}
              className="flex items-center justify-center gap-2 px-4 h-[44px] rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all text-sm"
              title="Ver Estadísticas"
            >
              <BarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">Estadísticas</span>
            </button>
            <input 
              type="file" 
              accept=".geojson,.json" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-4 h-[44px] rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all text-sm"
              title="Cargar archivo GeoJSON"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">GeoJSON</span>
            </button>
          </div>
        </div>

        <div className="text-sm opacity-80 whitespace-nowrap shrink-0 hidden md:block">
          {filteredStreets.length} {filteredStreets.length === 1 ? 'calle' : 'calles'}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Backdrop */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-black/50 z-[1001] md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Sidebar List */}
        <div className={`
          fixed inset-y-0 left-0 z-[1002] w-80 bg-white shadow-2xl flex flex-col overflow-y-auto transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:shadow-[4px_0_24px_rgba(0,0,0,0.1)] md:z-[1000]
          ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-4 border-b border-gray-100 bg-gray-50 sticky top-0 z-10 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-gray-700">Listado de Calles</h2>
              <p className="text-xs text-gray-500">{filteredStreets.length} resultados</p>
            </div>
            <button 
              onClick={() => setShowSidebar(false)}
              className="md:hidden p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-col p-2 gap-1">
            {filteredStreets.map(street => (
              <div 
                key={street.id}
                onMouseEnter={() => setHoveredStreetId(street.id)}
                onMouseLeave={() => setHoveredStreetId(null)}
                className={`p-3 rounded-lg cursor-pointer transition-colors border ${hoveredStreetId === street.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-2">
                  {getStreetIcon(street.type)}
                  <span className="font-medium text-sm text-gray-900 truncate">{street.name || 'Calle sin nombre'}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span className="capitalize">{(street.type || '').replace('_', ' ')}</span>
                  <span>{street.length > 1000 ? (street.length / 1000).toFixed(2) + ' km' : Math.round(street.length) + ' m'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <div className="text-lg font-medium text-gray-700">Obteniendo datos del mapa...</div>
            <div className="text-sm text-gray-500 mt-2">Consultando OpenStreetMap (Overpass API)</div>
          </div>
        )}

        <MapContainer 
          center={[21.196, -76.602]} 
          zoom={15} 
          className="w-full h-full z-0"
        >
          <MapHandler mode={displayMode} />
          <GeolocateControl />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoJsonData && (
            <GeoJSON 
              key={`geojson-${geoJsonKey}`} 
              data={geoJsonData} 
              style={{
                color: '#8b5cf6',
                weight: 3,
                opacity: 0.8,
                fillColor: '#8b5cf6',
                fillOpacity: 0.2
              }}
            />
          )}
          {filteredStreets.map(street => (
            <StreetPolyline 
              key={street.id} 
              street={street} 
              isHovered={hoveredStreetId === street.id} 
              onHover={handleHover} 
              onUnhover={handleUnhover} 
            />
          ))}
        </MapContainer>
      </div>
      </div>
      {showStatsPanel && (
        <StatsPanel 
          streets={streets} 
          onClose={() => setShowStatsPanel(false)} 
        />
      )}
    </div>
  );
}
