# SmartMail

SmartMail is an intelligent email management platform that connects to your Gmail account and uses local Natural Language Processing (NLP) to automatically categorize your emails besed on custom defined categories.

## 🚀 Features

- **Secure Authentication**: User registration and login system with password hashing 
- **Gmail Integration**: Secure OAuth2 connection to the Gmail API using Authlib.
- **Custom Categories**: Users can define their own email categories and manage them through the dashboard.
- **AI Classification**: Local email categorization using the `sentence-transformers` library. It uses the `all-MiniLM-L6-v2` model to perform semantic similarity analysis between email content and categories.

## 🛠️ Tech Stack

### Backend
- **Framework**: Flask
- **Database**: MySQL (with Connection Pooling)
- **Authentication**: OAuth2 & Custom Session-based auth
- **Machine Learning**: Sentence-Transformers (all-MiniLM-L6-v2)
- **API Clients**: Google API Client Library

### Frontend
- **Framework**: React
- **Styling**: Bootstrap 5

## 🔌 API Endpoints

| Route | Method | Purpose |
| :--- | :--- | :--- |
| `/register` | POST | Register a new user account. |
| `/login` | POST | Authenticate user and start session. |
| `/logout` | POST | Clear user session. |
| `/gmail/status` | GET | Check if Gmail is connected for the current user. |
| `/gmail-connect` | GET | Initiate the OAuth2 flow with Google. |
| `/google-auth` | GET | Handle the Google OAuth2 callback and store tokens. |
| `/categories` | GET, POST | List all categories or create a new custom category. |
| `/categories/<id>` | DELETE | Delete a specific email category. |
| `/get_emails` | GET | Retrieve all classified emails from the database. |
| `/init_emails` | GET | Perform initial email retrieval and AI classification on gmail connect. |
| `/sync_emails` | POST | Fetch and classify new emails since the last sync. |
| `/update_class` | POST | Re-run AI classification on all emails after category changes. |
| `/update_email_category` | POST | Manually override the category for a specific email. |


## Demo

<video src="demo/demo.mp4" width="100%" controls></video>
