import firebase_admin
from firebase_admin import auth, credentials

# 1. Connection (uses your .json file)
cred = credentials.Certificate("firebase-service-account.json")
firebase_admin.initialize_app(cred)

def mark_as_verified():
    print("🚀 Starting bulk verification...")
    # List all users (up to 1000)
    page = auth.list_users()
    
    count = 0
    while page:
        for user in page.users:
            # Only update if not yet verified
            if not user.email_verified:
                auth.update_user(user.uid, email_verified=True)
                print(f"✅ {user.email} marked as verified.")
                count += 1
        
        # Get the next page if there are more than 1000
        page = page.get_next_page()
        
    print(f"\n✨ Done. {count} users verified.")

if __name__ == "__main__":
    mark_as_verified()