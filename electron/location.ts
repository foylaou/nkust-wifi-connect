// import { parseStringPromise } from 'xml2js';
// import * as fs from 'fs';
// import * as geolib from 'geolib';
//
// /**
//  * 定義高科大的所有校區 (修正了 "建功校區")
//  */
// export enum NkustCampus {
//     Jiangong = "建功校區",
//     First = "第一校區",
//     Nanzi = "楠梓校區",
//     Yanchao = "燕巢校區",
//     Cijin = "旗津校區",
//     Dongfang = "東方校區"
// }
//
// /**
//  * 用於偵測位置的原始數據
//  * 根據您的偵測方式，這裡的欄位會不同
//  */
// export interface LocationIdentifiers {
//     ssid?: string;       // 目前連線的 Wi-Fi SSID
//     bssid?: string;      // Wi-Fi 存取點的 MAC 位址
//     gateway?: string;    // 預設閘道 IP
//     ip?: string;         // 本機 IP
// }
//
// /**
//  * 登入所需的憑證
//  */
// export interface UserCredentials {
//     username: string;
//     password: string;
// }
//
// /**
//  * 定義 "登入策略" 的共同介面
//  * 每個校區的登入邏輯都會實作這個 interface
//  */
// export interface ICampusLoginStrategy {
//     /**
//      * 執行登入動作
//      * @param credentials 使用者帳號密碼
//      * @returns 登入成功或失敗
//      */
//     login(credentials: UserCredentials): Promise<boolean>;
//
//     /**
//      * (可選) 執行登出動作
//      */
//     logout?(): Promise<boolean>;
// }
//
// // 假設您的 KML 文件名為 nkust_campus.kml
// const kmlString = fs.readFileSync('nkust_campus.kml', 'utf-8');
//
// // 最終目標資料結構：這是經過 KML 解析後，Node.js 應用程式會使用的格式。
// interface CampusPolygonData {
//     /**
//      * 校區名稱 (例如: '建功校區', '第一校區')
//      */
//     name: string;
//
//     /**
//      * 多邊形邊界點陣列。每個元素都是一個包含經度(lon)和緯度(lat)的物件。
//      * 這是 geolib 函式庫進行 Point-in-Polygon 運算時需要的格式。
//      */
//     polygon: { lat: number, lon: number }[];
// }
// interface polygon {
//     /**
//      * 這裡應對應 KML 的 <Polygon> 標籤內容，
//      * 由於 XML 解析器可能將標籤視為屬性，這裡表示了多邊形的外邊界。
//      */
//     Polygon: outerBoundaryIs
// }
//
// // 模擬 KML 中的 <outerBoundaryIs> 標籤內容
// interface outerBoundaryIs {
//     /**
//      * 表示多邊形外圍邊界的定義，其內容是一個線性環 (LinearRing)。
//      * 在 KML 中，<outerBoundaryIs> 定義了多邊形的外部邊界。
//      */
//     outerBoundaryIs: LinearRing
// }
//
// // 模擬 KML 中的 <LinearRing> 標籤內容
// interface LinearRing {
//     /**
//      * 表示線性環的定義。線性環是一系列連接的座標點，起點和終點必須相同。
//      * 這是包含實際座標字串的容器。
//      */
//     LinearRing: coordinates
// }
//
// // 模擬 KML 中的 <coordinates> 標籤內容
// interface coordinates {
//     /**
//      * 實際的地理座標字串。
//      * 格式為: "經度,緯度,海拔 經度,緯度,海拔 ..." (以空格分隔點)
//      * 這是在 XML 解析階段需要被提取和轉換成數字陣列的原始資料。
//      */
//     coordinates: string;
// }
//
// // --- 以下介面用於表示 KML XML 文件中的巢狀標籤結構 ---
//
// // 模擬 KML 中 <Polygon> 標籤所包含的內容（通常位於 <Placemark> 內）
//
// async function parseKmlData(kmlContent: string): Promise<CampusPolygonData[]> {
//     const result = await parseStringPromise(kmlContent, { explicitArray: false });
//     const placemarks = result.kml.Document.Placemark;
//
//     return placemarks.map((pm: polygon) => {
//         const coordsString: string = pm.Polygon.outerBoundaryIs.LinearRing.coordinates;
//
//         // 將 "經度,緯度,海拔 經度,緯度,海拔 ..." 字串，轉換成座標陣列
//         const coordsArray = coordsString
//             .trim()
//             .split(/\s+/) // 用空格分割每個座標點
//             .map(coord => {
//                 const [lon, lat, _alt] = coord.split(',').map(Number);
//                 // 大多數地理庫要求 { latitude: number, longitude: number } 格式
//                 return { lat, lon };
//             });
//
//         return {
//             name: pm.name,
//             polygon: coordsArray
//         };
//     });
// }
//
// // 假設這是您 parseKmlData 輸出結果的介面
// interface CampusPolygonData {
//     name: string;
//     polygon: { lat: number, lon: number }[];
// }
// // console.log(kmlString);
// const [result] = await Promise.all([parseKmlData(kmlString)])
// console.log(result[0])
//
// /**
//  * 根據經緯度判斷用戶目前所在的校區
//  * @param userLat 用戶的緯度 (Latitude)
//  * @param userLon 用戶的經度 (Longitude)
//  * @param campusPolygons 已經解析好的 KML 多邊形資料
//  * @returns 所在的校區名稱，如果找不到則返回 '未知校區'
//  */
// function identifyCampus(
//     userLat: number,
//     userLon: number,
//     campusPolygons: CampusPolygonData[]
// ): string {
//     const userLocation = { latitude: userLat, longitude: userLon };
//
//     for (const campusData of campusPolygons) {
//
//         // 將您的 { lat, lon } 陣列轉換為 geolib.isPointInPolygon 要求的格式
//         // 注意：geolib 的屬性名稱是 'latitude' 和 'longitude'
//         const polygonForGeolib = campusData.polygon.map(p => ({
//             latitude: p.lat,
//             longitude: p.lon
//         }));
//
//         // 執行 Point-in-Polygon 檢查
//         const isInside = geolib.isPointInPolygon(
//             userLocation,
//             polygonForGeolib
//         );
//
//         if (isInside) {
//             // 返回校區名稱 (例如: '建功校區')
//             return campusData.name;
//         }
//     }
//
//     return '未知校區';
// }
