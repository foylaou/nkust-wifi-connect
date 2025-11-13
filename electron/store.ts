// electron/store.ts
import Store from "electron-store";

interface StoreSchema {
    studentId: string;
    password: string;
}

const store = new Store<StoreSchema>({
    name: "nkust-wifi-config",
    defaults: {
        studentId: "",
        password: "",
    },
});

export function getCredentials(): { studentId: string; password: string } {
    return {
        studentId: store.get("studentId", ""),
        password: store.get("password", ""),
    };
}

export function setCredentials(studentId: string, password: string): void {
    store.set("studentId", studentId);
    store.set("password", password);
}

export function hasCredentials(): boolean {
    const creds = getCredentials();
    return creds.studentId !== "" && creds.password !== "";
}

export function clearCredentials(): void {
    store.set("studentId", "");
    store.set("password", "");
}
