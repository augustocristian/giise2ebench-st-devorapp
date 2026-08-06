import firebase_admin
from firebase_admin import auth, credentials

# 1. Conexión (usa tu archivo .json)
cred = credentials.Certificate("firebase-service-account.json")
firebase_admin.initialize_app(cred)

def marcar_como_verificados():
    print("🚀 Iniciando verificacion masiva...")
    # Listamos todos los usuarios (hasta 1000)
    page = auth.list_users()
    
    count = 0
    while page:
        for user in page.users:
            # Solo actualizamos si no esta verificado
            if not user.email_verified:
                auth.update_user(user.uid, email_verified=True)
                print(f"✅ {user.email} marcado como verificado.")
                count += 1
        
        # Obtener siguiente página si hay más de 1000
        page = page.get_next_page()
        
    print(f"\n✨ Proceso terminado. {count} usuarios verificados.")

if __name__ == "__main__":
    marcar_como_verificados()