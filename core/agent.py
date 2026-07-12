import ollama
import config
from PIL import Image
import json
import logging
import io
import re
import os
import base64
import requests
import time
from utils.logger import setup_logger

# Configure Logging
logger = setup_logger(__name__)

CONFIG_FILE = "model_config.json"

class IncidentAgent:
    api_usage_stats = {} # Format: {"provider": {"rpm_used": 0, "rpm_limit": 15, "history": [], "cooldown_until": 0, "status": "Active", "uses_headers": False}}
    API_LIMITS = {"gemini": 15, "groq": 30, "mistral": 30, "huggingface": 20, "custom": 30}
    
    @classmethod
    def _init_stats(cls, provider):
        if provider not in cls.api_usage_stats:
            cls.api_usage_stats[provider] = {
                "rpm_used": 0, 
                "rpm_limit": cls.API_LIMITS.get(provider, 30), 
                "history": [],
                "cooldown_until": 0,
                "status": "Active",
                "uses_headers": False
            }

    @classmethod
    def get_api_stats(cls):
        current_time = time.time()
        for p in cls.api_usage_stats:
            stats = cls.api_usage_stats[p]
            stats["history"] = [t for t in stats["history"] if current_time - t < 60]
            if not stats.get("uses_headers", False):
                stats["rpm_used"] = len(stats["history"])
                
            if current_time < stats["cooldown_until"]:
                stats["status"] = "Cooldown"
            else:
                stats["status"] = "Active"
                stats["cooldown_until"] = 0
        return cls.api_usage_stats

    @classmethod
    def _track_request(cls, provider):
        cls._init_stats(provider)
        cls.api_usage_stats[provider]["history"].append(time.time())

    def __init__(self):
        pass # Configuration is loaded dynamically per request to allow hot-swapping
        
    def _load_config(self):
        default_config = {
            "active_mode": "local",
            "provider": "ollama",
            "model_name": config.LOCAL_LLM_MODEL,
            "api_key": ""
        }
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    return json.load(f)
            except:
                return default_config
        return default_config

    def analyze_incident(self, image_input, detections, context_str=""):
        cfg = self._load_config()
        active_mode = cfg.get("active_mode", "local")
        provider = cfg.get("provider", "ollama")
        model_name = cfg.get("model_name", config.LOCAL_LLM_MODEL)
        api_keys = cfg.get("api_keys", {})
        api_key = api_keys.get(provider, cfg.get("api_key", ""))
        
        prompt = f"""
Act as an expert Security Analyst. You are monitoring a live surveillance feed.
I will provide you with an image and a list of objects detected by a YOLO model: {detections}.
{f"CRITICAL SYSTEM ALERTS TO CONSIDER:\\n{context_str}" if context_str else ""}

TASK:
Analyze the image carefully. Identify any suspicious activity, safety threats, or unusual behavior based on the visual context and any provided system alerts.

CRITICAL THREAT EVALUATION GUIDELINES (FOLLOW STRICTLY):
1. ROBBERY/THEFT: If you see people hastily taking items from shelves/displays and putting them into bags, backpacks, or pockets, this is a ROBBERY. You MUST output "Critical" and "High".
2. VIOLENCE/WEAPONS: If you see physical struggles, fighting, or weapons (guns, knives, bats), you MUST output "Critical" and "High".
3. SUSPICIOUS BEHAVIOR: Sneaking, crouching to avoid detection, wearing masks/face coverings indoors, or forced entry MUST be output as "Suspicious" and "Medium".
4. NORMAL: Only if people are calmly standing, walking, or waiting without doing any of the above, output "Normal" and "Low".
{f"5. CUSTOM USER RULE: {cfg.get('custom_prompt', '')}" if cfg.get('custom_prompt') else ""}
OUTPUT REQUIREMENTS:
You MUST respond with a raw JSON object and absolutely nothing else. Do not use placeholders.
Your JSON must strictly contain the following keys and data types:
- "classification" (string): Must be exactly "Normal", "Suspicious", or "Critical".
- "severity" (string): Must be exactly "Low", "Medium", or "High".
- "confidence_score" (integer): A number between 0 and 100 representing your confidence.
- "description" (string): A detailed 2-3 sentence analysis of what is physically happening in the image.
- "recommendation" (string): Actionable advice for security personnel based on the threat level.
"""

        # Optimize image for transmission and processing
        max_size = 800
        if max(image_input.size) > max_size:
            image_input.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        if active_mode == "local":
            try:
                response_text = self._call_ollama(image_input, prompt, cfg.get("model_name", config.LOCAL_LLM_MODEL))
                return self._parse_json(response_text)
            except Exception as e:
                logger.error(f"Local VLM Analysis Failed: {e}")
                return self._error_response(e, "Local Engine")

        # Cloud Mode with Fallback
        cloud_models = cfg.get("cloud_models", [])
        if not cloud_models:
            return self._error_response("No cloud models configured", "Configuration")

        # Reorder to put primary first
        primary_models = [m for m in cloud_models if m.get("is_primary")]
        fallback_models = [m for m in cloud_models if not m.get("is_primary")]
        execution_sequence = primary_models + fallback_models

        for model_cfg in execution_sequence:
            provider = model_cfg.get("provider", "").lower()
            model_name = model_cfg.get("model", "")
            api_key = model_cfg.get("api_key", "")
            base_url = model_cfg.get("base_url", "")

            try:
                logger.info(f"Attempting analysis with {provider} ({model_name})...")
                response_text = self._attempt_analysis(provider, model_name, api_key, base_url, image_input, prompt)
                parsed = self._parse_json(response_text)

                # If we used a fallback, append a note
                if not model_cfg.get("is_primary"):
                    parsed["description"] = f"[Fallback: {provider}] " + parsed.get("description", "")

                return parsed
            except Exception as e:
                logger.warning(f"Analysis failed with {provider} ({model_name}): {e}. Attempting fallback...")
                continue

        # Ultimate failsafe: try Ollama if all cloud APIs fail
        try:
            logger.warning("All cloud APIs failed. Attempting ultimate fallback to Local Edge (Ollama)...")
            response_text = self._call_ollama(image_input, prompt, config.LOCAL_LLM_MODEL)
            parsed = self._parse_json(response_text)
            parsed["description"] = "[Fallback: Local Edge] " + parsed.get("description", "")
            return parsed
        except Exception as e:
            logger.error(f"Ultimate fallback to Local Edge failed: {e}")
            return self._error_response("All cloud models and local fallback failed", "System")

    def _error_response(self, error, provider):
        return {
            "classification": "Error",
            "severity": "Low",
            "confidence_score": 0,
            "description": f"Analysis failed: {str(error)}",
            "recommendation": f"Check {provider} configuration and API keys."
        }

    def _attempt_analysis(self, provider, model_name, api_key, base_url, img, prompt):
        self._init_stats(provider)
        stats = self.api_usage_stats[provider]
        
        if time.time() < stats["cooldown_until"]:
            raise Exception(f"429 Too Many Requests ({provider} Cooldown active)")
            
        self._track_request(provider)
        
        try:
            if provider == "gemini":
                return self._call_gemini(img, prompt, model_name, api_key)
            elif provider == "groq":
                return self._call_groq(img, prompt, model_name, api_key, provider)
            elif provider == "huggingface":
                return self._call_huggingface(img, prompt, model_name, api_key, provider)
            else:
                return self._call_custom_openai(img, prompt, model_name, api_key, base_url, provider)
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "too many requests" in error_str or "rate limit" in error_str or "quota" in error_str:
                cooldown_s = 60
                delay_match = re.search(r'retry_delay\s*\{\s*seconds:\s*(\d+)\s*\}', error_str, re.IGNORECASE)
                if delay_match:
                    cooldown_s = int(delay_match.group(1)) + 5
                logger.error(f"Rate limit hit for {provider}. Entering {cooldown_s}s cooldown.")
                stats["cooldown_until"] = time.time() + cooldown_s
                stats["status"] = "Cooldown"
            raise e

    def _call_custom_openai(self, img, prompt, model_name, api_key, base_url, provider="custom"):
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=70)
        base64_image = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        
        if not base_url:
            raise ValueError("Base URL is required for custom providers.")
            
        if not base_url.endswith("/chat/completions"):
            base_url = base_url.rstrip("/") + "/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 500
        }

        response = requests.post(base_url, headers=headers, json=payload, timeout=15)
        
        if provider in self.api_usage_stats:
            stats = self.api_usage_stats[provider]
            if "x-ratelimit-remaining" in response.headers and "x-ratelimit-limit" in response.headers:
                try:
                    stats["rpm_limit"] = int(response.headers["x-ratelimit-limit"])
                    stats["rpm_used"] = stats["rpm_limit"] - int(response.headers["x-ratelimit-remaining"])
                    stats["uses_headers"] = True
                except:
                    pass

        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]



    def _parse_json(self, text_response):
        text_response = text_response.strip()
        if not text_response:
            raise ValueError("Empty response from model.")
            
        try:
            return json.loads(text_response)
        except json.JSONDecodeError:
            # Strip out markdown block if present
            match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text_response, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1))
                except:
                    pass
                    
            # Fallback: Extract from first { to last }
            start_idx = text_response.find('{')
            end_idx = text_response.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_str = text_response[start_idx:end_idx+1]
                # Sometimes models output invalid control characters
                json_str = json_str.replace('\n', ' ').replace('\r', '')
                try:
                    return json.loads(json_str)
                except:
                    pass
                    
            raise ValueError(f"Could not parse valid JSON from model response. Raw: {text_response[:100]}...")

    def _call_ollama(self, img, prompt, model_name):
        client = ollama.Client(host=config.OLLAMA_HOST)
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=70)
        img_bytes = img_byte_arr.getvalue()
        kwargs = {
            "model": model_name,
            "prompt": prompt,
            "images": [img_bytes],
            "stream": False,
            "options": {"temperature": 0.1}
        }
        
        # Qwen-VL models sometimes break when forced into JSON mode via the API.
        # We only apply strict JSON formatting to other models (like LLaVA/Moondream).
        if "qwen" not in model_name.lower():
            kwargs["format"] = "json"
            
        response = client.generate(**kwargs)
        return response.get('response', '')

    def _call_gemini(self, img, prompt, model_name, api_key):
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=[prompt, img]
        )
        return response.text

    def _call_groq(self, img, prompt, model_name, api_key, provider="groq"):
        from groq import Groq
        client = Groq(api_key=api_key)
        
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=70)
        base64_image = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        
        raw_response = client.chat.completions.with_raw_response.create(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                            },
                        },
                    ],
                }
            ],
            model=model_name
        )
        
        # Extract dynamic headers from Groq
        if provider in self.api_usage_stats:
            stats = self.api_usage_stats[provider]
            headers = raw_response.headers
            if "x-ratelimit-remaining-requests" in headers and "x-ratelimit-limit-requests" in headers:
                try:
                    stats["rpm_limit"] = int(headers["x-ratelimit-limit-requests"])
                    stats["rpm_used"] = stats["rpm_limit"] - int(headers["x-ratelimit-remaining-requests"])
                    stats["uses_headers"] = True
                except:
                    pass
                    
        parsed = raw_response.parse()
        return parsed.choices[0].message.content

    def _call_huggingface(self, img, prompt, model_name, api_key, provider="huggingface"):
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=70)
        base64_image = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        
        API_URL = f"https://api-inference.huggingface.co/models/{model_name}/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
        
        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 500
        }
        
        response = requests.post(API_URL, headers=headers, json=payload)
        
        if provider in self.api_usage_stats:
            stats = self.api_usage_stats[provider]
            if "x-ratelimit-remaining" in response.headers and "x-ratelimit-limit" in response.headers:
                try:
                    stats["rpm_limit"] = int(response.headers["x-ratelimit-limit"])
                    stats["rpm_used"] = stats["rpm_limit"] - int(response.headers["x-ratelimit-remaining"])
                    stats["uses_headers"] = True
                except:
                    pass

        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
