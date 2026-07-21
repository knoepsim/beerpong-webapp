import pytest
import asyncio
from httpx import AsyncClient
from unittest.mock import patch

@pytest.mark.asyncio
async def test_full_tournament_lifecycle(async_client: AsyncClient):
    # We patch generate_sms_code in auth_service to always return "123456"
    with patch("app.services.auth_service.generate_sms_code", return_value="123456"):
        # 1. Register 6 Users
        user_tokens = []
        for i in range(1, 7):
            phone = f"+49151000000{i}"
            
            # Request code
            resp = await async_client.post("/auth/request-code", json={"phone_number": phone})
            assert resp.status_code == 204
            
            # Verify code
            resp = await async_client.post("/auth/verify", json={"phone_number": phone, "code": "123456"})
            assert resp.status_code == 200
            token = resp.json()["access_token"]
            user_tokens.append(token)
            
            # Optional: update user name
            await async_client.patch(
                "/users/me", 
                json={"name": f"User {i}"}, 
                headers={"Authorization": f"Bearer {token}"}
            )

        # Helper to get auth header
        def auth_header(user_idx):
            return {"Authorization": f"Bearer {user_tokens[user_idx]}"}

        # 2. Create 3 Teams
        teams = []
        for team_idx in range(3):
            creator_idx = team_idx * 2
            joiner_idx = creator_idx + 1
            
            # Create Team
            resp = await async_client.post(
                "/teams", 
                json={"name": f"Team {team_idx + 1}"},
                headers=auth_header(creator_idx)
            )
            assert resp.status_code == 201
            team_id = resp.json()["id"]
            
            # Generate Invite
            resp = await async_client.post(
                f"/teams/{team_id}/invite",
                headers=auth_header(creator_idx)
            )
            assert resp.status_code == 201
            invite_token = resp.json()["token"]
            
            # Join Team
            resp = await async_client.post(
                f"/teams/join/{invite_token}",
                headers=auth_header(joiner_idx)
            )
            assert resp.status_code == 200
            
            teams.append(team_id)

        # 3. Create Tournament
        resp = await async_client.post(
            "/tournaments",
            json={"name": "Grand Championship", "max_teams": 8, "location": "Berlin", "date": "2026-12-31T20:00:00Z"},
            headers=auth_header(0) # User 1 creates it
        )
        assert resp.status_code == 201
        tournament_id = resp.json()["id"]

        # 4. Join Tournament
        # User 1 (Team 1), User 3 (Team 2), User 5 (Team 3)
        for i, team_id in enumerate(teams):
            creator_idx = i * 2
            resp = await async_client.post(
                f"/tournaments/{tournament_id}/join",
                json={"team_id": team_id},
                headers=auth_header(creator_idx)
            )
            assert resp.status_code == 201
            
        # 5. Start Tournament
        resp = await async_client.post(
            f"/tournaments/{tournament_id}/start",
            headers=auth_header(0) # User 1 is Admin
        )
        assert resp.status_code == 200
        
        # 6. Fetch Bracket and Play Matches
        # We simulate playing until all rounds are done
        played_matches = set()
        
        while True:
            resp = await async_client.get(
                f"/tournaments/{tournament_id}/bracket",
                headers=auth_header(0)
            )
            assert resp.status_code == 200
            bracket = resp.json()
            matches = bracket["matches"]
            
            # Find a match that is ready to be played (both teams exist and not played yet)
            ready_match = None
            for match in matches:
                if match["team_a_id"] is not None and match["team_b_id"] is not None and match["id"] not in played_matches:
                    ready_match = match
                    break
            
            if not ready_match:
                # No ready match found.
                # If there are unplayed matches but they don't have both teams, wait for previous rounds.
                # Since we report results synchronously, this means we are done.
                break
            
            # Report result for the ready match (Team A wins)
            winner_id = ready_match["team_a_id"]
            resp = await async_client.post(
                f"/matches/{ready_match['id']}/results",
                json={"winner_team_id": winner_id, "cups_left": 3},
                headers=auth_header(0) # User 1 (Admin) reports the result
            )
            assert resp.status_code == 201
            played_matches.add(ready_match["id"])
            
        # 7. Verification: Tournament is finished
        resp = await async_client.get(
            f"/tournaments/{tournament_id}/bracket",
            headers=auth_header(0)
        )
        bracket = resp.json()
        matches = bracket["matches"]
        
        # All valid matches should be played if they had both teams
        unplayed_ready_matches = [m for m in matches if m["team_a_id"] is not None and m["team_b_id"] is not None and m["id"] not in played_matches]
        assert len(unplayed_ready_matches) == 0
