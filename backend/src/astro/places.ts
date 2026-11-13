// Small offline list of Indian cities (lat, lon). All use IST (UTC+5:30), so no timezone lookup is needed.
// Replace with a geocoding service (Nominatim / Google Places) plus a timezone database when non-India births are supported.
export interface Place { name: string; state: string; lat: number; lon: number }
export const IST_OFFSET = 5.5
export const PLACES: Place[] = [
  ['Delhi', 'Delhi', 28.6139, 77.2090], ['Mumbai', 'Maharashtra', 19.0760, 72.8777], ['Kolkata', 'West Bengal', 22.5726, 88.3639],
  ['Chennai', 'Tamil Nadu', 13.0827, 80.2707], ['Bengaluru', 'Karnataka', 12.9716, 77.5946], ['Hyderabad', 'Telangana', 17.3850, 78.4867],
  ['Ahmedabad', 'Gujarat', 23.0225, 72.5714], ['Pune', 'Maharashtra', 18.5204, 73.8567], ['Jaipur', 'Rajasthan', 26.9124, 75.7873],
  ['Lucknow', 'Uttar Pradesh', 26.8467, 80.9462], ['Kanpur', 'Uttar Pradesh', 26.4499, 80.3319], ['Nagpur', 'Maharashtra', 21.1458, 79.0882],
  ['Indore', 'Madhya Pradesh', 22.7196, 75.8577], ['Bhopal', 'Madhya Pradesh', 23.2599, 77.4126], ['Patna', 'Bihar', 25.5941, 85.1376],
  ['Vadodara', 'Gujarat', 22.3072, 73.1812], ['Surat', 'Gujarat', 21.1702, 72.8311], ['Ghaziabad', 'Uttar Pradesh', 28.6692, 77.4538],
  ['Noida', 'Uttar Pradesh', 28.5355, 77.3910], ['Greater Noida', 'Uttar Pradesh', 28.4744, 77.5040], ['Gurugram', 'Haryana', 28.4595, 77.0266],
  ['Faridabad', 'Haryana', 28.4089, 77.3178], ['Agra', 'Uttar Pradesh', 27.1767, 78.0081], ['Varanasi', 'Uttar Pradesh', 25.3176, 82.9739],
  ['Prayagraj', 'Uttar Pradesh', 25.4358, 81.8463], ['Meerut', 'Uttar Pradesh', 28.9845, 77.7064], ['Mathura', 'Uttar Pradesh', 27.4924, 77.6737],
  ['Chandigarh', 'Chandigarh', 30.7333, 76.7794], ['Ludhiana', 'Punjab', 30.9010, 75.8573], ['Amritsar', 'Punjab', 31.6340, 74.8723],
  ['Dehradun', 'Uttarakhand', 30.3165, 78.0322], ['Haridwar', 'Uttarakhand', 29.9457, 78.1642], ['Shimla', 'Himachal Pradesh', 31.1048, 77.1734],
  ['Srinagar', 'Jammu and Kashmir', 34.0837, 74.7973], ['Jammu', 'Jammu and Kashmir', 32.7266, 74.8570], ['Ranchi', 'Jharkhand', 23.3441, 85.3096],
  ['Raipur', 'Chhattisgarh', 21.2514, 81.6296], ['Bhubaneswar', 'Odisha', 20.2961, 85.8245], ['Guwahati', 'Assam', 26.1445, 91.7362],
  ['Visakhapatnam', 'Andhra Pradesh', 17.6868, 83.2185], ['Vijayawada', 'Andhra Pradesh', 16.5062, 80.6480], ['Coimbatore', 'Tamil Nadu', 11.0168, 76.9558],
  ['Madurai', 'Tamil Nadu', 9.9252, 78.1198], ['Kochi', 'Kerala', 9.9312, 76.2673], ['Thiruvananthapuram', 'Kerala', 8.5241, 76.9366],
  ['Mysuru', 'Karnataka', 12.2958, 76.6394], ['Mangaluru', 'Karnataka', 12.9141, 74.8560], ['Goa (Panaji)', 'Goa', 15.4909, 73.8278],
  ['Nashik', 'Maharashtra', 19.9975, 73.7898], ['Jodhpur', 'Rajasthan', 26.2389, 73.0243], ['Udaipur', 'Rajasthan', 24.5854, 73.7125],
  ['Gwalior', 'Madhya Pradesh', 26.2183, 78.1828], ['Jabalpur', 'Madhya Pradesh', 23.1815, 79.9864], ['Ujjain', 'Madhya Pradesh', 23.1765, 75.7885],
  ['Gorakhpur', 'Uttar Pradesh', 26.7606, 83.3732], ['Bareilly', 'Uttar Pradesh', 28.3670, 79.4304], ['Aligarh', 'Uttar Pradesh', 27.8974, 78.0880],
  ['Moradabad', 'Uttar Pradesh', 28.8386, 78.7733], ['Muzaffarpur', 'Bihar', 26.1209, 85.3647], ['Gaya', 'Bihar', 24.7914, 85.0002],
].map(([name, state, lat, lon]) => ({ name, state, lat, lon }) as Place)

export function searchPlaces(q: string, limit = 8): Place[] {
  const s = q.trim().toLowerCase()
  if (s.length < 2) return []
  const starts = PLACES.filter(p => p.name.toLowerCase().startsWith(s))
  const rest = PLACES.filter(p => !starts.includes(p) && (p.name.toLowerCase().includes(s) || p.state.toLowerCase().startsWith(s)))
  return [...starts, ...rest].slice(0, limit)
}
