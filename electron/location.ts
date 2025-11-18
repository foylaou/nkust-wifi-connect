import { parseStringPromise } from 'xml2js';
import * as fs from 'fs';
import * as geolib from 'geolib';

/**
 * 定義高科大的所有校區 (修正了 "建功校區")
 */
export enum NkustCampus {
    Jiangong = "建功校區",
    First = "第一校區",
    Nanzi = "楠梓校區",
    Yanchao = "燕巢校區",
    Cijin = "旗津校區",
    Dongfang = "東方校區"
}

/**
 * 每個校區的主要經緯度 (用於距離計算的中心點)
 */
export const CAMPUS_CENTER_COORDS = new Map<NkustCampus, { lat: number, lon: number }>([
    [NkustCampus.First, { lat: 22.755835, lon: 120.353318 }], // 採用東校區與西校區的中心點附近
    [NkustCampus.Jiangong, { lat: 22.645068, lon: 120.320438 }],
    [NkustCampus.Nanzi, { lat: 22.709335, lon: 120.316885 }],
    [NkustCampus.Yanchao, { lat: 22.793796, lon: 120.370509 }],
    [NkustCampus.Cijin, { lat: 22.607311, lon: 120.281520 }], // 採用兩個地址的中間點
    [NkustCampus.Dongfang, { lat: 22.880436, lon: 120.260589 }], // 如果您決定將東方校區納入
]);

/**
 * 用於偵測位置的原始數據
 * 根據您的偵測方式，這裡的欄位會不同
 */
export interface LocationIdentifiers {
    ssid?: string;       // 目前連線的 Wi-Fi SSID
    bssid?: string;      // Wi-Fi 存取點的 MAC 位址
    gateway?: string;    // 預設閘道 IP
    ip?: string;         // 本機 IP
}

/**
 * 登入所需的憑證
 */
export interface UserCredentials {
    username: string;
    password: string;
}

/**
 * 定義 "登入策略" 的共同介面
 * 每個校區的登入邏輯都會實作這個 interface
 */
export interface ICampusLoginStrategy {
    /**
     * 執行登入動作
     * @param credentials 使用者帳號密碼
     * @returns 登入成功或失敗
     */
    login(credentials: UserCredentials): Promise<boolean>;

    /**
     * (可選) 執行登出動作
     */
    logout?(): Promise<boolean>;
}

// 假設您的 KML 文件名為 nkust_campus.kml
const kmlString = fs.readFileSync('nkust_campus.kml', 'utf-8');

// 定義您的結構
interface CampusPolygonData {
    name: string;
    polygon: { lat: number, lon: number }[];
}

async function parseKmlData(kmlContent: string): Promise<CampusPolygonData[]> {
    const result = await parseStringPromise(kmlContent, { explicitArray: false });
    const placemarks = result.kml.Document.Placemark;

    return placemarks.map((pm: any) => {
        const coordsString: string = pm.Polygon.outerBoundaryIs.LinearRing.coordinates;

        // 將 "經度,緯度,海拔 經度,緯度,海拔 ..." 字串，轉換成座標陣列
        const coordsArray = coordsString
            .trim()
            .split(/\s+/) // 用空格分割每個座標點
            .map(coord => {
                const [lon, lat, _alt] = coord.split(',').map(Number);
                // 大多數地理庫要求 { latitude: number, longitude: number } 格式
                return { lat, lon };
            });

        return {
            name: pm.name,
            polygon: coordsArray
        };
    });
}

// 假設這是您 parseKmlData 輸出結果的介面
interface CampusPolygonData {
    name: string;
    polygon: { lat: number, lon: number }[];
}
// console.log(kmlString);
const [result] = await Promise.all([parseKmlData(kmlString)])
console.log(result[0].polygon)
/**
 * 根據經緯度判斷用戶目前所在的校區
 * @param userLat 用戶的緯度 (Latitude)
 * @param userLon 用戶的經度 (Longitude)
 * @param campusPolygons 已經解析好的 KML 多邊形資料
 * @returns 所在的校區名稱，如果找不到則返回 '未知校區'
 */
function identifyCampus(
    userLat: number,
    userLon: number,
    campusPolygons: CampusPolygonData[]
): string {
    const userLocation = { latitude: userLat, longitude: userLon };

    for (const campusData of campusPolygons) {

        // 將您的 { lat, lon } 陣列轉換為 geolib.isPointInPolygon 要求的格式
        // 注意：geolib 的屬性名稱是 'latitude' 和 'longitude'
        const polygonForGeolib = campusData.polygon.map(p => ({
            latitude: p.lat,
            longitude: p.lon
        }));

        // 執行 Point-in-Polygon 檢查
        const isInside = geolib.isPointInPolygon(
            userLocation,
            polygonForGeolib
        );

        if (isInside) {
            // 返回校區名稱 (例如: '建功校區')
            return campusData.name;
        }
    }

    return '未知校區';
}
