const fetchurl = "https://api.worldlabs.ai/marble/v1/worlds:generate";
const operationsUrl = "https://api.worldlabs.ai/marble/v1/operations";



// Function to fetch model and collision mesh
async function fetchModelAndCollision(prompt = "A mystical forest with glowing mushrooms") {
  try {
    // Initial generate request
    const response = await fetch(fetchurl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'WLT-Api-Key': process.env.WORLDLABS_API_KEY 
      },
      body: JSON.stringify({
        display_name: 'Generated World',
        world_prompt: {
          type: 'text',
          text_prompt: prompt
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const operationId = data.operation_id;

    // Poll the operations endpoint until complete
    let operationData;
    while (true) {
      const opResponse = await fetch(`${operationsUrl}/${operationId}`, {
        headers: {
          'WLT-Api-Key': process.env.WORLDLABS_API_KEY 
        }
      });

      if (!opResponse.ok) {
        throw new Error(`Operation fetch error! status: ${opResponse.status}`);
      }

      operationData = await opResponse.json();
      if (operationData.done) {
        break;
      } else if (operationData.error) {
        throw new Error(`Operation failed: ${operationData.error}`);
      }

      console.log('Generation in progress...', operationData.metadata?.progress?.description);
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Extract assets from completed operation response
    const assets = operationData.response?.assets;
    const splatUrl = assets?.splats?.spz_urls?.full_res;
    const collisionMeshUrl = assets?.mesh?.collider_mesh_url;
    const caption = assets?.caption;

    console.log('Model URL:', splatUrl);
    console.log('Collision Mesh URL:', collisionMeshUrl);
    console.log('Caption:', caption);

    return { splatUrl, collisionMeshUrl, caption, worldId: operationData.metadata?.world_id };
  } catch (error) {
    console.error('Error fetching model and collision mesh:', error);
    throw error;
  }
}

export { fetchModelAndCollision };
